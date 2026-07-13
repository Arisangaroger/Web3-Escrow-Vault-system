import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHistory } from '../api/client';

const History = () => {
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    filterHistory();
  }, [history, searchTerm, outcomeFilter]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await getHistory();
      if (response.success) {
        setHistory(response.data);
        setFilteredHistory(response.data);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const filterHistory = () => {
    let filtered = [...history];

    // Search filter (deal ID or phone numbers)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (record) =>
          record.dealId.toString().includes(term) ||
          record.senderPhone.includes(term) ||
          record.driverPhone.includes(term) ||
          record.receiverPhone.includes(term) ||
          record.resolvedBy.toLowerCase().includes(term)
      );
    }

    // Outcome filter
    if (outcomeFilter !== 'all') {
      filtered = filtered.filter(
        (record) => record.resolutionOutcome === outcomeFilter
      );
    }

    setFilteredHistory(filtered);
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const getOutcomeLabel = (outcome) => {
    const labels = {
      DRIVER_FRAUD: 'Driver Fraud',
      FAULTY_GOODS: 'Faulty Goods',
      FALSE_BUYER_CLAIM: 'False Claim',
    };
    return labels[outcome] || outcome;
  };

  const getOutcomeColor = (outcome) => {
    const colors = {
      DRIVER_FRAUD: 'red',
      FAULTY_GOODS: 'orange',
      FALSE_BUYER_CLAIM: 'blue',
    };
    return colors[outcome] || 'gray';
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Resolution History</h1>
          <p>Past disputes and their outcomes</p>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/')} className="btn-primary">
            Back to Queue
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {!loading && !error && (
          <div className="filters-section">
            <div className="filter-group">
              <input
                type="text"
                placeholder="Search by Deal ID, phone, or admin..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-group">
              <label>Outcome:</label>
              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Outcomes</option>
                <option value="DRIVER_FRAUD">Driver Fraud</option>
                <option value="FAULTY_GOODS">Faulty Goods</option>
                <option value="FALSE_BUYER_CLAIM">False Claim</option>
              </select>
            </div>
            <div className="filter-results">
              Showing {filteredHistory.length} of {history.length} records
            </div>
          </div>
        )}
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading history...</p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {!loading && !error && history.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h2>No History Yet</h2>
            <p>Resolved disputes will appear here.</p>
          </div>
        )}

        {!loading && !error && history.length > 0 && filteredHistory.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h2>No Matches Found</h2>
            <p>Try adjusting your search or filters.</p>
          </div>
        )}

        {!loading && !error && filteredHistory.length > 0 && (
          <div className="disputes-table">
            <table>
              <thead>
                <tr>
                  <th>Deal ID</th>
                  <th>Amount</th>
                  <th>Original Dispute</th>
                  <th>Resolution</th>
                  <th>Resolved By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((record) => (
                  <tr key={record.dealId}>
                    <td>
                      <strong>#{record.dealId}</strong>
                    </td>
                    <td>{formatAmount(record.amount)}</td>
                    <td>{record.disputeReasonText}</td>
                    <td>
                      <span
                        className="outcome-badge"
                        style={{
                          backgroundColor: `var(--${getOutcomeColor(
                            record.resolutionOutcome
                          )})`,
                        }}
                      >
                        {getOutcomeLabel(record.resolutionOutcome)}
                      </span>
                    </td>
                    <td>{record.resolvedBy}</td>
                    <td>{formatDate(record.resolvedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default History;
