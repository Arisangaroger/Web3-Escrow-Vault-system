import React from 'react';

const Timeline = ({ timeline }) => {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionIcon = (action) => {
    const icons = {
      Created: '📝',
      Locked: '🔒',
      Shipped: '🚚',
      Delivered: '📦',
      Revoked: '⚠️',
      Cancelled: '❌',
      Released: '✅',
      Resolved: '⚖️',
    };

    for (const [key, icon] of Object.entries(icons)) {
      if (action.includes(key)) return icon;
    }
    return '•';
  };

  const getActionLabel = (action) => {
    // Clean up action names for display
    return action
      .replace('AdminResolution_', 'Admin Resolved: ')
      .replace(/_/g, ' ');
  };

  return (
    <div className="timeline-card">
      <div className="card-header">
        <h2>Action Timeline</h2>
        <p>Chronological sequence of all deal actions</p>
      </div>

      <div className="timeline">
        {timeline.map((entry, index) => (
          <div key={index} className="timeline-entry">
            <div className="timeline-marker">
              <span className="timeline-icon">{getActionIcon(entry.action)}</span>
              {index < timeline.length - 1 && <div className="timeline-line"></div>}
            </div>

            <div className="timeline-content">
              <div className="timeline-header">
                <strong className="timeline-action">
                  {getActionLabel(entry.action)}
                </strong>
                <span className="timeline-time">{formatTime(entry.timestamp)}</span>
              </div>

              <div className="timeline-details">
                <span className="timeline-actor">
                  by {entry.actorPhone || entry.actorName}
                </span>
                {entry.txHash && (
                  <span className="timeline-tx" title={entry.txHash}>
                    Tx: {entry.txHash.slice(0, 10)}...
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timeline;
