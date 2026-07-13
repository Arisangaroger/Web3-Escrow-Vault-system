import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDisputeDetail } from '../api/client';
import DealSummaryCard from '../components/DealSummaryCard';
import Timeline from '../components/Timeline';
import ResolutionPanel from '../components/ResolutionPanel';

const DisputeDetail = () => {
  const { dealId } = useParams();
  const navigate = useNavigate();
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDispute();
  }, [dealId]);

  const loadDispute = async () => {
    try {
      setLoading(true);
      const response = await getDisputeDetail(dealId);
      if (response.success) {
        setDispute(response.data);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Failed to load dispute details');
    } finally {
      setLoading(false);
    }
  };

  const handleResolutionComplete = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading dispute details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')} className="btn-primary">
          Back to Queue
        </button>
      </div>
    );
  }

  return (
    <div className="dispute-detail">
      <header className="detail-header">
        <button onClick={() => navigate('/')} className="btn-back">
          ← Back to Queue
        </button>
        <h1>Dispute #{dispute.dealId}</h1>
      </header>

      <div className="detail-content">
        <div className="detail-main">
          <DealSummaryCard dispute={dispute} />
          <Timeline timeline={dispute.timeline} />
        </div>

        <div className="detail-sidebar">
          <ResolutionPanel
            dealId={dispute.dealId}
            onComplete={handleResolutionComplete}
          />
        </div>
      </div>
    </div>
  );
};

export default DisputeDetail;
