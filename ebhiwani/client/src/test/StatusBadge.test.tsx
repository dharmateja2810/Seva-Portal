import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from '../components/StatusBadge';

describe('StatusBadge', () => {
  it('renders New status', () => {
    render(<StatusBadge status="New" />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('renders Pending status', () => {
    render(<StatusBadge status="Pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders In Progress status', () => {
    render(<StatusBadge status="In Progress" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders Resolved status', () => {
    render(<StatusBadge status="Resolved" />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('renders Closed status', () => {
    render(<StatusBadge status="Closed" />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });
});
