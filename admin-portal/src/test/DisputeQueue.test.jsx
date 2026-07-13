import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DisputeQueue from '../pages/DisputeQueue';
import { AuthProvider } from '../context/AuthContext';
import * as api from '../api/client';

vi.mock('../api/client');

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>{component}</AuthProvider>
    </BrowserRouter>
  );
};

const mockDisputes = [
  {
    dealId: 1,
    amount: '500000',
    senderPhone: '0788111111',
    driverPhone: '0788222222',
    receiverPhone: '0788333333',
    disputeReasonText: 'Goods not received',
    createdAt: new Date().toISOString(),
  },
  {
    dealId: 2,
    amount: '250000',
    senderPhone: '0788444444',
    driverPhone: '0788555555',
    receiverPhone: '0788666666',
    disputeReasonText: 'Damaged goods',
    createdAt: new Date().toISOString(),
  },
];

describe('DisputeQueue Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getMe.mockResolvedValue({
      success: true,
      data: { name: 'Test Admin', email: 'admin@test.com' },
    });
  });

  it('shows loading state initially', () => {
    api.getDisputes.mockImplementation(() => new Promise(() => {}));

    renderWithRouter(<DisputeQueue />);

    expect(screen.getByText(/loading disputes/i)).toBeInTheDocument();
  });

  it('shows empty state when no disputes', async () => {
    api.getDisputes.mockResolvedValue({
      success: true,
      data: [],
    });

    renderWithRouter(<DisputeQueue />);

    await waitFor(() => {
      expect(screen.getByText(/no active disputes/i)).toBeInTheDocument();
    });
  });

  it('renders dispute list correctly', async () => {
    api.getDisputes.mockResolvedValue({
      success: true,
      data: [mockDisputes[0]],
    });

    renderWithRouter(<DisputeQueue />);

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText(/goods not received/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /review/i })).toBeInTheDocument();
    });
  });

  it('filters disputes by search term', async () => {
    api.getDisputes.mockResolvedValue({
      success: true,
      data: mockDisputes,
    });

    renderWithRouter(<DisputeQueue />);

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText(/search by deal id/i),
      { target: { value: '0788444444' } }
    );

    await waitFor(() => {
      expect(screen.queryByText('#1')).not.toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText(/showing 1 of 2 disputes/i)).toBeInTheDocument();
    });
  });

  it('shows error state on API failure', async () => {
    api.getDisputes.mockResolvedValue({
      success: false,
      error: 'Failed to load disputes',
    });

    renderWithRouter(<DisputeQueue />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load disputes/i)).toBeInTheDocument();
    });
  });
});
