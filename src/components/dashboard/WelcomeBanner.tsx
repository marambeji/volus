import { CalendarDays, Plus } from 'lucide-react';

// Helper to get greeting based on time of day
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Format today's date nicely
function formatDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface WelcomeBannerProps {
  onRequestTimeOff: () => void;
}

export default function WelcomeBanner({ onRequestTimeOff }: WelcomeBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1b2559] via-[#16224F] to-[#111c44] text-white shadow-lg mb-6">
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-white opacity-5 rounded-full" />
      <div className="absolute -bottom-16 -right-4 w-64 h-64 bg-white opacity-5 rounded-full" />
      <div className="absolute top-4 right-24 w-20 h-20 bg-white opacity-5 rounded-full" />

      <div className="relative px-6 py-8 md:py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Left: Greeting */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays size={18} className="opacity-80" />
              <span className="text-blue-200 text-sm font-medium">{formatDate()}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">
              {getGreeting()}, Gabriel 👋
            </h1>
            <p className="text-blue-200 text-sm md:text-base">
              You have <span className="text-white font-semibold">18 days</span> of leave remaining this year.
            </p>
          </div>

          {/* Right: Request Time Off button */}
          <div className="flex-shrink-0">
            <button
              onClick={onRequestTimeOff}
              className="flex items-center gap-2 bg-[#96C13C] hover:bg-[#83aa32] text-white font-extrabold px-6 py-3 rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all duration-150 cursor-pointer"
            >
              <Plus size={18} />
              Request Time Off
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
