import React from 'react';

const UserDetailModal = ({ user, role, onClose }) => {
  if (!user) return null;

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content user-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{role} Details</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="user-info-grid">
            <div className="info-row">
              <span className="info-label">Full Name:</span>
              <span className="info-value">{user.fullName || 'Not provided'}</span>
            </div>

            <div className="info-row">
              <span className="info-label">Phone Number:</span>
              <span className="info-value phone-value">
                {user.phone}
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(user.phone)}
                  title="Copy phone number"
                >
                  📋
                </button>
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">National ID:</span>
              <span className="info-value">{user.nationalId || 'Not provided'}</span>
            </div>

            <div className="info-row">
              <span className="info-label">Location:</span>
              <span className="info-value">{user.location || 'Not provided'}</span>
            </div>

            <div className="info-row">
              <span className="info-label">Wallet Address:</span>
              <span className="info-value wallet-value">
                <code>{user.walletAddress}</code>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(user.walletAddress)}
                  title="Copy wallet address"
                >
                  📋
                </button>
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Registered:</span>
              <span className="info-value">{formatDate(user.registeredAt)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailModal;
