import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResolutionPanel from '../components/ResolutionPanel';
import * as api from '../api/client';

vi.mock('../api/client');

describe('ResolutionPanel Component', () => {
  const mockOnComplete = vi.fn();
  const dealId = 1;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all three resolution buttons', () => {
    render(<ResolutionPanel dealId={dealId} onComplete={mockOnComplete} />);
    
    expect(screen.getByText(/driver fraud/i)).toBeInTheDocument();
    expect(screen.getByText(/faulty goods/i)).toBeInTheDocument();
    expect(screen.getByText(/false buyer claim/i)).toBeInTheDocument();
  });

  it('shows warning message', () => {
    render(<ResolutionPanel dealId={dealId} onComplete={mockOnComplete} />);
    
    expect(screen.getByText(/warning/i)).toBeInTheDocument();
    expect(screen.getByText(/irreversible/i)).toBeInTheDocument();
  });

  it('shows confirmation modal when button clicked', () => {
    render(<ResolutionPanel dealId={dealId} onComplete={mockOnComplete} />);
    
    const driverFraudButton = screen.getByText(/driver fraud/i);
    fireEvent.click(driverFraudButton);
    
    expect(screen.getByText(/confirm resolution/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('closes modal when cancel clicked', () => {
    render(<ResolutionPanel dealId={dealId} onComplete={mockOnComplete} />);
    
    const driverFraudButton = screen.getByText(/driver fraud/i);
    fireEvent.click(driverFraudButton);
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    
    expect(screen.queryByText(/confirm resolution/i)).not.toBeInTheDocument();
  });

  it('calls API and onComplete when resolution confirmed', async () => {
    api.getDisputeDetail.mockResolvedValue({
      success: true,
      data: { status: 'Disputed' },
    });
    
    api.resolveDispute.mockResolvedValue({
      success: true,
      data: { txHash: '0x123' },
    });
    
    render(<ResolutionPanel dealId={dealId} onComplete={mockOnComplete} />);
    
    const driverFraudButton = screen.getByText(/driver fraud/i);
    fireEvent.click(driverFraudButton);
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(api.getDisputeDetail).toHaveBeenCalledWith(dealId);
      expect(api.resolveDispute).toHaveBeenCalledWith(dealId, 'DRIVER_FRAUD');
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('shows error if deal status changed', async () => {
    api.getDisputeDetail.mockResolvedValue({
      success: true,
      data: { status: 'Released' }, // No longer disputed
    });
    
    render(<ResolutionPanel dealId={dealId} onComplete={mockOnComplete} />);
    
    const driverFraudButton = screen.getByText(/driver fraud/i);
    fireEvent.click(driverFraudButton);
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(screen.getByText(/cannot resolve/i)).toBeInTheDocument();
      expect(api.resolveDispute).not.toHaveBeenCalled();
    });
  });
});
