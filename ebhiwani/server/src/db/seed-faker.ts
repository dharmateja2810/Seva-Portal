/**
 * Faker seed — generates 100 realistic PHED complaints
 * Run: npx ts-node src/db/seed-faker.ts
 */
import { faker } from '@faker-js/faker';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME     || 'ebhiwani',
});

const ENC_KEY = process.env.PII_ENCRYPTION_KEY || 'ebhiwani-pii-key-32chars-change!';

// ── Reference data (must match what's in DB) ────────────────────
const STATUSES   = ['New', 'Pending', 'In Progress', 'Resolved', 'Closed'] as const;
const SOURCES    = ['Walk-in', 'Phone Call', 'WhatsApp', 'Inspection', 'Office Entry'];

// These will be fetched live from the DB
type TehsilRow   = { id: number; name: string };
type CategoryRow = { id: number; name: string; sla_days: number };
type UserRow     = { id: number };

// Haryana-flavoured location fragments
const WARDS      = ['Ward 1', 'Ward 3', 'Ward 7', 'Ward 12', 'Ward 15', 'Ward 18'];
const VILLAGES   = [
  'Rohnat', 'Kairu', 'Siwana', 'Dulheri', 'Jitpura', 'Bapora',
  'Khanak', 'Mundhal', 'Nangal Choudhary', 'Igrah',
];
const STREETS    = [
  'Main Bazar Road', 'Near Bus Stand', 'Railway Road', 'Old Town Area',
  'Sector 4', 'Model Town', 'Gandhi Chowk', 'Hanuman Mandir Gali',
];

function randomLocation(): string {
  const pick = faker.number.int({ min: 0, max: 2 });
  if (pick === 0) return `${faker.helpers.arrayElement(WARDS)}, ${faker.helpers.arrayElement(STREETS)}`;
  if (pick === 1) return `Village ${faker.helpers.arrayElement(VILLAGES)}`;
  return `${faker.helpers.arrayElement(STREETS)}, Near ${faker.helpers.arrayElement(VILLAGES)}`;
}

function randomDate(daysAgo: number): Date {
  return faker.date.recent({ days: daysAgo });
}

// Weighted status — more open than closed (realistic backlog)
function weightedStatus(): typeof STATUSES[number] {
  const r = faker.number.float({ min: 0, max: 1 });
  if (r < 0.20) return 'New';
  if (r < 0.38) return 'Pending';
  if (r < 0.55) return 'In Progress';
  if (r < 0.72) return 'Resolved';
  return 'Closed';
}

async function run() {
  const client = await pool.connect();
  try {
    const tehsils   = (await client.query<TehsilRow>('SELECT id, name FROM tehsils')).rows;
    const categories = (await client.query<CategoryRow>('SELECT id, name, sla_days FROM complaint_categories')).rows;
    const operators  = (await client.query<UserRow>(`SELECT id FROM users WHERE role IN ('phed_operator','phed_nodal','phed_admin')`)).rows;

    if (!tehsils.length || !categories.length) {
      console.error('Run the base migrations first (001_init + 002_seed)');
      process.exit(1);
    }

    console.log(`Seeding 100 complaints across ${tehsils.length} tehsils, ${categories.length} categories…`);

    await client.query('BEGIN');

    for (let i = 0; i < 100; i++) {
      const tehsil   = faker.helpers.arrayElement<TehsilRow>(tehsils);
      const category = faker.helpers.arrayElement<CategoryRow>(categories);
      const status   = weightedStatus();
      const source   = faker.helpers.arrayElement(SOURCES);
      const location = randomLocation();
      const createdAt = randomDate(120);

      // Due date = created + sla_days
      const dueDate = new Date(createdAt);
      dueDate.setDate(dueDate.getDate() + category.sla_days);

      // Assign to a random operator ~70% of the time
      const assignedTo = (operators.length && faker.number.float() < 0.7)
        ? faker.helpers.arrayElement<UserRow>(operators).id
        : null;

      const createdBy = faker.helpers.arrayElement<UserRow>(operators).id;

      // Encrypted PII
      const nameEnc  = `pgp_sym_encrypt($1, '${ENC_KEY}')`;
      const phoneEnc = `pgp_sym_encrypt($2, '${ENC_KEY}')`;

      const complainantName  = faker.person.fullName();
      const complainantPhone = `9${faker.string.numeric(9)}`;  // Indian mobile
      const description      = faker.helpers.maybe(
        () => faker.lorem.sentences({ min: 1, max: 3 }),
        { probability: 0.75 }
      );

      // Get next complaint number
      const seqRes = await client.query<{ nextval: string }>(`SELECT nextval('complaint_number_seq')`);
      const complaintNumber = parseInt(seqRes.rows[0]!.nextval, 10);

      const insertRes = await client.query<{ id: number }>(
        `INSERT INTO complaints (
           complaint_number, source, tehsil_id, location, category_id, description,
           complainant_name_enc, complainant_phone_enc,
           status, created_by, assigned_to, due_date, created_at, updated_at
         ) VALUES (
           $3, $4, $5, $6, $7, $8,
           ${nameEnc}, ${phoneEnc},
           $9, $10, $11, $12, $13, $13
         ) RETURNING id`,
        [
          complainantName,   // $1 → name enc
          complainantPhone,  // $2 → phone enc
          complaintNumber,   // $3
          source,            // $4
          tehsil.id,         // $5
          location,          // $6
          category.id,       // $7
          description ?? null, // $8
          status,            // $9
          createdBy,         // $10
          assignedTo,        // $11
          dueDate,           // $12
          createdAt,         // $13
        ]
      );

      const complaintId = insertRes.rows[0]!.id;

      // ── Status history ─────────────────────────────────────────
      // Always insert the initial 'New' entry
      await client.query(
        `INSERT INTO status_history (complaint_id, from_status, to_status, updated_by, notes, created_at)
         VALUES ($1, NULL, 'New', $2, 'Complaint registered', $3)`,
        [complaintId, createdBy, createdAt]
      );

      // Add intermediate transitions matching the final status
      const transitions: Array<{ from: string; to: string; daysAfter: number }> = [];

      if (['Pending','In Progress','Resolved','Closed'].includes(status)) {
        transitions.push({ from: 'New', to: 'Pending', daysAfter: faker.number.int({ min: 1, max: 3 }) });
      }
      if (['In Progress','Resolved','Closed'].includes(status)) {
        transitions.push({ from: 'Pending', to: 'In Progress', daysAfter: faker.number.int({ min: 1, max: 5 }) });
      }
      if (['Resolved','Closed'].includes(status)) {
        transitions.push({ from: 'In Progress', to: 'Resolved', daysAfter: faker.number.int({ min: 1, max: 10 }) });
      }
      if (status === 'Closed') {
        transitions.push({ from: 'Resolved', to: 'Closed', daysAfter: faker.number.int({ min: 1, max: 3 }) });
      }

      let cursor = new Date(createdAt);
      for (const t of transitions) {
        cursor = new Date(cursor);
        cursor.setDate(cursor.getDate() + t.daysAfter);
        const updater = assignedTo ?? createdBy;
        await client.query(
          `INSERT INTO status_history (complaint_id, from_status, to_status, updated_by, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            complaintId,
            t.from,
            t.to,
            updater,
            faker.helpers.arrayElement([
              'Field visit done', 'Under investigation', 'Work order issued',
              'Repaired successfully', 'Verified by inspector', 'Closed after resolution',
              null, null,  // ~30% no note
            ]),
            cursor,
          ]
        );
      }

      process.stdout.write(`\r  ${i + 1}/100`);
    }

    await client.query('COMMIT');
    console.log('\n✅  100 complaints inserted successfully.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Seed failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
