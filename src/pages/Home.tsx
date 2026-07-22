import { useState } from 'react';
import WelcomeBanner from '../components/dashboard/WelcomeBanner';
import StatsBar from '../components/dashboard/StatsBar';
import WhosOut from '../components/dashboard/WhosOut';
import UpcomingHolidays from '../components/dashboard/UpcomingHolidays';
import CompanyLinks from '../components/dashboard/CompanyLinks';
import RequestModal from '../components/dashboard/RequestModal';

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      {/* Request Time Off Modal */}
      <RequestModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Welcome Banner */}
      <WelcomeBanner onRequestTimeOff={() => setModalOpen(true)} />

      {/* Stats Row */}
      <StatsBar />

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Who's Out (takes 2 cols) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <WhosOut />
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-6">
          <UpcomingHolidays />
          <CompanyLinks />
        </div>
      </div>
    </>
  );
}
