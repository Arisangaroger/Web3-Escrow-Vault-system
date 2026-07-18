import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResolutionPanel from '../components/ResolutionPanel';
import * as api from '../api/client';

vi.mock('../api/client');

const clickDriverFraud = () => {
  fireEvent.click(document.querySelector('.resolution-btn.resolution-red'));
};

describe('ResolutionPanel Component', () => {
  const mockOnSubmitted = vi.fn();
  const dealId = 1;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all three resolution buttons', () => {
    render(
      <ResolutionPanel
        dealId={dealId}
        status="Disputed"
        onSubmitted={mockOnSubmitted}
      />,
    );

    expect(document.querySelectorAll('.resolution-btn')).toHaveLength(3);
    expect(screen.getByText('Driver Fraud')).toBeInTheDocument();
    expect(screen.getByText('Faulty Goods')).toBeInTheDocument();
    expect(screen.getByText('False Buyer Claim')).toBeInTheDocument();
  });

  it('shows pending banner when status is ResolutionPending', () => {
    render(
      <ResolutionPanel
        dealId={dealId}
        status="ResolutionPending"
        pendingTxHash="0xabc"
        onSubmitted={mockOnSubmitted}
      />,
    );

    expect(screen.getByText(/resolution pending/i)).toBeInTheDocument();
    expect(screen.getByText(/processing on-chain/i)).toBeInTheDocument();
    expect(screen.getByText(/0xabc/)).toBeInTheDocument();
    expect(document.querySelector('.resolution-btn')).toBeNull();
  });

  it('shows warning message', () => {
    render(
      <ResolutionPanel
        dealId={dealId}
        status="Disputed"
        onSubmitted={mockOnSubmitted}
      />,
    );

    expect(screen.getByText(/warning/i)).toBeInTheDocument();
    expect(screen.getByText(/irreversible/i)).toBeInTheDocument();
  });

  it('shows confirmation modal when button clicked', () => {
    render(
      <ResolutionPanel
        dealId={dealId}
        status="Disputed"
        onSubmitted={mockOnSubmitted}
      />,
    );

    clickDriverFraud();

    expect(screen.getByText(/confirm resolution/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByText(/blockchain confirmation can take a few minutes/i),
    ).toBeInTheDocument();
  });

  it('closes modal when cancel clicked', () => {
    render(
      <ResolutionPanel
        dealId={dealId}
        status="Disputed"
        onSubmitted={mockOnSubmitted}
      />,
    );

    clickDriverFraud();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText(/confirm resolution/i)).not.toBeInTheDocument();
  });

  it('calls API and onSubmitted when resolution confirmed', async () => {
    api.getDisputeDetail.mockResolvedValue({
      success: true,
      data: { status: 'Disputed' },
    });

    api.resolveDispute.mockResolvedValue({
      success: true,
      data: { txHash: '0x123', status: 'ResolutionPending' },
    });

    render(
      <ResolutionPanel
        dealId={dealId}
        status="Disputed"
        onSubmitted={mockOnSubmitted}
      />,
    );

    clickDriverFraud();
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(api.getDisputeDetail).toHaveBeenCalledWith(dealId);
      expect(api.resolveDispute).toHaveBeenCalledWith(dealId, 'DRIVER_FRAUD');
      expect(mockOnSubmitted).toHaveBeenCalledWith({
        txHash: '0x123',
        status: 'ResolutionPending',
      });
    });
  });

  it('shows error if deal status changed', async () => {
    api.getDisputeDetail.mockResolvedValue({
      success: true,
      data: { status: 'Released' },
    });

    render(
      <ResolutionPanel
        dealId={dealId}
        status="Disputed"
        onSubmitted={mockOnSubmitted}
      />,
    );

    clickDriverFraud();
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/cannot resolve/i)).toBeInTheDocument();
      expect(api.resolveDispute).not.toHaveBeenCalled();
    });
  });
});
