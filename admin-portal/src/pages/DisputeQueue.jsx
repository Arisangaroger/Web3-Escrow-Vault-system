import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDisputes } from '../api/client';

const POLL_MS = 5000;

const statusLabel = (status) => {
  if (status === 'ResolutionPending') return 'Processing';
  if (status === 'Disputed') return 'Disputed';
  return status || 'Disputed';
};

const statusClass = (status) => {
  if (status === 'ResolutionPending') return 'status-resolution-pending';
  if (status === 'Resolved') return 'status-resolved';
  return 'status-disputed';
};

const DisputeQueue = () => {
  const [disputes, setDisputes] = useState([]);
  const [filteredDisputes, setFilteredDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pollRef = useRef(null);

  useEffect(() => {
    if (location.state?.flash) {
      setFlash(location.state.flash);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    loadDisputes(true);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    filterDisputes();
  }, [disputes, searchTerm, reasonFilter]);

  useEffect(() => {
    const hasPending = disputes.some((d) => d.status === 'ResolutionPending');
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (hasPending) {
      pollRef.current = setInterval(() => loadDisputes(false), POLL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [disputes]);

  const loadDisputes = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const response = await getDisputes();
      if (response.success) {
        setDisputes(response.data);
        setError('');
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Failed to load disputes');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const filterDisputes = () => {
    let filtered = [...disputes];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (dispute) =>
          dispute.dealId.toString().includes(term) ||
          (dispute.senderPhone || '').toLowerCase().includes(term) ||
          (dispute.driverPhone || '').toLowerCase().includes(term) ||
          (dispute.receiverPhone || '').toLowerCase().includes(term) ||
          (dispute.disputeReasonText || '').toLowerCase().includes(term)
      );
    }

    if (reasonFilter !== 'all') {
      filtered = filtered.filter(
        (dispute) =>
          (dispute.disputeReasonText || '').toLowerCase() ===
          reasonFilter.toLowerCase()
      );
    }

    setFilteredDisputes(filtered);
  };

  const reasonOptions = Array.from(
    new Set(
      disputes
        .map((d) => d.disputeReasonText)
        .filter((reason) => Boolean(reason))
    )
  ).sort();

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
    }).format(amount);
  };

  const getTimeSince = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 24) {
      return `${Math.floor(hours / 24)} days ago`;
    }
    if (hours > 0) {
      return `${hours} hours ago`;
    }
    return `${minutes} minutes ago`;
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Dispute Queue</h1>
          <p>Active disputes requiring resolution</p>
        </div>
        <div className="header-actions">
          <span className="admin-name">{admin?.name}</span>
          <button onClick={() => navigate('/history')} className="btn-secondary">
            View History
          </button>
          <button onClick={logout} className="btn-secondary">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {flash && (
          <div className="success-banner" role="status">
            {flash}
          </div>
        )}

        {!loading && !error && disputes.length > 0 && (
          <div className="filters-section">
            <div className="filter-group">
              <input
                type="text"
                placeholder="Search by Deal ID, phone, or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-group">
              <label>Reason:</label>
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Reasons</option>
                {reasonOptions.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-results">
              Showing {filteredDisputes.length} of {disputes.length} disputes
            </div>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading disputes...</p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {!loading && !error && disputes.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <h2>No Active Disputes</h2>
            <p>All deals are running smoothly. Check back later.</p>
          </div>
        )}

        {!loading && !error && disputes.length > 0 && filteredDisputes.length === 0 && (
          <div className="empty-state">
            <h2>No Matching Disputes</h2>
            <p>Try adjusting your search or filters.</p>
          </div>
        )}

        {!loading && !error && filteredDisputes.length > 0 && (
          <div className="disputes-table">
            <table>
              <thead>
                <tr>
                  <th>Deal ID</th>
                  <th>Amount</th>
                  <th>Parties</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Disputed</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDisputes.map((dispute) => {
                  const pending = dispute.status === 'ResolutionPending';
                  return (
                    <tr
                      key={dispute.dealId}
                      className={pending ? 'row-resolution-pending' : undefined}
                    >
                      <td>
                        <strong>#{dispute.dealId}</strong>
                      </td>
                      <td>{formatAmount(dispute.amount)}</td>
                      <td>
                        <div className="parties-info">
                          <div>Sender: {dispute.senderPhone}</div>
                          <div>Driver: {dispute.driverPhone}</div>
                          <div>Receiver: {dispute.receiverPhone}</div>
                        </div>
                      </td>
                      <td>
                        <span className="reason-badge">
                          {dispute.disputeReasonText}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${statusClass(dispute.status)}`}>
                          {pending && <span className="spinner spinner-inline" aria-hidden="true" />}
                          {statusLabel(dispute.status)}
                        </span>
                      </td>
                      <td>
                        <span className="time-ago">
                          {getTimeSince(dispute.createdAt)}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/disputes/${dispute.dealId}`)}
                          className="btn-primary btn-sm"
                          disabled={pending}
                          title={
                            pending
                              ? 'Resolution already submitted — awaiting confirmation'
                              : 'Review dispute'
                          }
                        >
                          {pending ? 'Processing…' : 'Review'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default DisputeQueue;
