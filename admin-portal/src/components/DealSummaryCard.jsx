import React from 'react';

const DealSummaryCard = ({ dispute }) => {
  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="deal-summary-card">
      <div className="card-header">
        <h2>Deal Summary</h2>
        <span className="status-badge status-disputed">{dispute.status}</span>
      </div>

      <div className="card-body">
        <div className="summary-row">
          <span className="label">Amount:</span>
          <span className="value amount">{formatAmount(dispute.amount)}</span>
        </div>

        <div className="summary-row">
          <span className="label">Dispute Reason:</span>
          <span className="value">{dispute.disputeReasonText}</span>
        </div>

        <div className="parties-section">
          <h3>Parties Involved</h3>
          <div className="party-row">
            <span className="party-role">Farmer (Sender):</span>
            <span className="party-phone">{dispute.senderPhone}</span>
          </div>
          <div className="party-row">
            <span className="party-role">Driver:</span>
            <span className="party-phone">{dispute.driverPhone}</span>
          </div>
          <div className="party-row">
            <span className="party-role">Buyer (Receiver):</span>
            <span className="party-phone">{dispute.receiverPhone}</span>
          </div>
        </div>

        <div className="timestamps">
          <div className="timestamp-row">
            <span className="label">Created:</span>
            <span className="value">{formatDate(dispute.createdAt)}</span>
          </div>
          {dispute.fundLockDeadline && (
            <div className="timestamp-row">
              <span className="label">Fund Lock Deadline:</span>
              <span className="value">
                {formatDate(dispute.fundLockDeadline)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DealSummaryCard;
