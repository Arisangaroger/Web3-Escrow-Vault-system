import React from 'react';

const ConfirmModal = ({ title, message, details, onConfirm, onCancel, loading }) => {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>{title}</h2>
        </div>

        <div className="modal-body">
          <p className="modal-message">{message}</p>
          {details && <p className="modal-details">{details}</p>}
        </div>

        <div className="modal-footer">
          <button
            onClick={onCancel}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn-danger"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
