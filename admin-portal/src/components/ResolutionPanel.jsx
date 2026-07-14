import React, { useState } from 'react';
import { getDisputeDetail, resolveDispute } from '../api/client';
import ConfirmModal from './ConfirmModal';

const ResolutionPanel = ({ dealId, onComplete }) => {
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');

  const outcomes = [
    {
      value: 'DRIVER_FRAUD',
      label: 'Driver Fraud',
      description:
        'Driver lied about delivery. Refund 100% locked funds to buyer. (Driver pay is off-platform.)',
      color: 'red',
      icon: '🚫',
    },
    {
      value: 'FAULTY_GOODS',
      label: 'Faulty Goods',
      description:
        'Goods were defective (not driver fraud). Refund 100% to buyer — same escrow split; transport fee stays between farmer and driver outside this system.',
      color: 'orange',
      icon: '📦',
    },
    {
      value: 'FALSE_BUYER_CLAIM',
      label: 'False Buyer Claim',
      description: 'Buyer claim rejected. Pay 100% locked funds to farmer.',
      color: 'blue',
      icon: '✓',
    },
  ];

  const handleOutcomeClick = (outcome) => {
    setSelectedOutcome(outcome);
    setShowConfirm(true);
    setError('');
  };

  const handleConfirm = async () => {
    setResolving(true);
    setError('');

    try {
      // Re-fetch deal status to ensure it's still disputed (safety check)
      const detailResponse = await getDisputeDetail(dealId);
      
      if (!detailResponse.success) {
        setError('Failed to verify deal status');
        setResolving(false);
        return;
      }

      if (detailResponse.data.status !== 'Disputed') {
        setError(`Cannot resolve: Deal is now in ${detailResponse.data.status} status`);
        setResolving(false);
        setShowConfirm(false);
        // Refresh page to show current state
        setTimeout(() => window.location.reload(), 2000);
        return;
      }

      // Proceed with resolution
      const response = await resolveDispute(dealId, selectedOutcome.value);

      if (response.success) {
        setShowConfirm(false);
        onComplete();
      } else {
        setError(response.error || 'Resolution failed');
      }
    } catch (err) {
      setError('Failed to resolve dispute. Please try again.');
    } finally {
      setResolving(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setSelectedOutcome(null);
    setError('');
  };

  return (
    <div className="resolution-panel">
      <div className="panel-header">
        <h2>Resolution Actions</h2>
        <p>Select the appropriate resolution based on investigation</p>
      </div>

      <div className="panel-content">
        {error && <div className="error-message">{error}</div>}

        <div className="resolution-options">
          {outcomes.map((outcome) => (
            <button
              key={outcome.value}
              onClick={() => handleOutcomeClick(outcome)}
              className={`resolution-btn resolution-${outcome.color}`}
              disabled={resolving}
            >
              <span className="resolution-icon">{outcome.icon}</span>
              <div className="resolution-text">
                <strong>{outcome.label}</strong>
                <p>{outcome.description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="panel-warning">
          <strong>⚠️ Warning:</strong>
          <p>
            Resolution actions are irreversible and immediately move funds on the
            blockchain. Ensure you have investigated the dispute thoroughly before
            proceeding.
          </p>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          title="Confirm Resolution"
          message={`Are you sure you want to resolve this dispute as "${selectedOutcome.label}"? This action cannot be undone.`}
          details={selectedOutcome.description}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          loading={resolving}
        />
      )}
    </div>
  );
};

export default ResolutionPanel;
