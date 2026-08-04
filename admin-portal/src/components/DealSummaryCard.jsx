import React, { useState } from 'react';
import UserDetailModal from './UserDetailModal';

const DealSummaryCard = ({ dispute }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const handleUserClick = (user, role) => {
    setSelectedUser(user);
    setSelectedRole(role);
  };

  const closeModal = () => {
    setSelectedUser(null);
    setSelectedRole('');
  };

  const status = dispute.status || 'Disputed';
  const statusClass =
    status === 'ResolutionPending'
      ? 'status-resolution-pending'
      : status === 'Resolved'
        ? 'status-resolved'
        : 'status-disputed';
  const statusText =
    status === 'ResolutionPending' ? 'Processing' : status;

  return (
    <>
      <div className="deal-summary-card">
        <div className="card-header">
          <h2>Deal Summary</h2>
          <span className={`status-badge ${statusClass}`}>{statusText}</span>
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
              {dispute.sender ? (
                <button
                  className="party-link"
                  onClick={() => handleUserClick(dispute.sender, 'Farmer (Sender)')}
                  title="Click to view farmer details"
                >
                  {dispute.senderPhone} 👤
                </button>
              ) : (
                <span className="party-phone">{dispute.senderPhone}</span>
              )}
            </div>
            <div className="party-row">
              <span className="party-role">Driver:</span>
              {dispute.driver ? (
                <button
                  className="party-link"
                  onClick={() => handleUserClick(dispute.driver, 'Driver')}
                  title="Click to view driver details"
                >
                  {dispute.driverPhone} 👤
                </button>
              ) : (
                <span className="party-phone">{dispute.driverPhone}</span>
              )}
            </div>
            <div className="party-row">
              <span className="party-role">Buyer (Receiver):</span>
              {dispute.receiver ? (
                <button
                  className="party-link"
                  onClick={() => handleUserClick(dispute.receiver, 'Buyer (Receiver)')}
                  title="Click to view buyer details"
                >
                  {dispute.receiverPhone} 👤
                </button>
              ) : (
                <span className="party-phone">{dispute.receiverPhone}</span>
              )}
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

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          role={selectedRole}
          onClose={closeModal}
        />
      )}
    </>
  );
};

export default DealSummaryCard;
