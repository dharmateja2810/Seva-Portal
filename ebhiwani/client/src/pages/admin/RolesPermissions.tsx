import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const ROLES = ['System Admin', 'PHED Admin', 'PHED Updater', 'DC Viewer'];

const PERMISSIONS: {
  label: string;
  system_admin: boolean;
  phed_admin:   boolean;
  phed_updater: boolean;
  dc_viewer:    boolean;
}[] = [
  { label: 'View PHED Dashboard',       system_admin: true,  phed_admin: true,  phed_updater: true,  dc_viewer: true  },
  { label: 'View Complaints',           system_admin: true,  phed_admin: true,  phed_updater: true,  dc_viewer: true  },
  { label: 'Register Complaint',        system_admin: true,  phed_admin: true,  phed_updater: true,  dc_viewer: false },
  { label: 'Edit Complaint Details',    system_admin: true,  phed_admin: true,  phed_updater: true,  dc_viewer: false },
  { label: 'Change Complaint Status',   system_admin: true,  phed_admin: true,  phed_updater: true,  dc_viewer: false },
  { label: 'Assign Complaints',         system_admin: true,  phed_admin: true,  phed_updater: false, dc_viewer: false },
  { label: 'View Reports',              system_admin: true,  phed_admin: true,  phed_updater: false, dc_viewer: false },
  { label: 'Manage Users',              system_admin: true,  phed_admin: true,  phed_updater: false, dc_viewer: false },
  { label: 'Manage Masters',            system_admin: true,  phed_admin: true,  phed_updater: false, dc_viewer: false },
];

const ROLE_KEYS = ['system_admin', 'phed_admin', 'phed_updater', 'dc_viewer'] as const;

export default function RolesPermissions() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-950">Roles &amp; Permissions</h1>
        <p className="text-sm text-brand-500/70 mt-0.5">
          Permissions defined for each role. Contact system administrator to modify.
        </p>
      </div>

      {/* Matrix */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="card overflow-hidden"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-100 bg-brand-50/60">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-brand-500/70 w-72">
                Interface / Action
              </th>
              {ROLES.map((role) => (
                <th
                  key={role}
                  className="text-center px-4 py-3.5 text-xs font-semibold text-brand-700 min-w-[120px]"
                >
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((perm, i) => (
              <motion.tr
                key={perm.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="border-b border-brand-50 last:border-0 hover:bg-brand-50/40 transition-colors"
              >
                <td className="px-5 py-3.5 font-medium text-brand-800">{perm.label}</td>
                {ROLE_KEYS.map((key) => (
                  <td key={key} className="px-4 py-3.5 text-center">
                    {perm[key] ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-100">
                        <Check className="w-3.5 h-3.5 text-brand-700 stroke-[2.5]" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-50">
                        <X className="w-3.5 h-3.5 text-brand-300 stroke-[2]" />
                      </span>
                    )}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-brand-500/70">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100">
            <Check className="w-3 h-3 text-brand-700 stroke-[2.5]" />
          </span>
          Allowed
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-50">
            <X className="w-3 h-3 text-brand-300 stroke-[2]" />
          </span>
          Not allowed
        </div>
      </div>
    </div>
  );
}
