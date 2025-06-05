import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = '#007acc',
  className = ''
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8'
  };

  return (
    <div 
      className={`inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite] ${sizeClasses[size]} ${className}`}
      style={{ borderColor: `${color} transparent ${color} ${color}` }}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

interface LoadingOverlayProps {
  show: boolean;
  message?: string;
  backdrop?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  show,
  message = 'Loading...',
  backdrop = true
}) => {
  if (!show) return null;

  return (
    <div className={`
      fixed inset-0 z-50 flex items-center justify-center
      ${backdrop ? 'bg-black bg-opacity-50' : ''}
    `}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg flex flex-col items-center space-y-4">
        <LoadingSpinner size="large" />
        <p className="text-gray-700 dark:text-gray-300 font-medium">{message}</p>
      </div>
    </div>
  );
};

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  className = ''
}) => {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      style={{ width, height }}
      aria-label="Loading content"
    />
  );
};

interface SkeletonListProps {
  count: number;
  itemHeight?: string | number;
  spacing?: string;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  count,
  itemHeight = '3rem',
  spacing = '0.5rem'
}) => {
  return (
    <div className="space-y-2" style={{ gap: spacing }}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={itemHeight} />
      ))}
    </div>
  );
};

interface ProgressBarProps {
  progress: number; // 0-100
  color?: string;
  backgroundColor?: string;
  height?: string;
  showPercentage?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = '#007acc',
  backgroundColor = '#e5e7eb',
  height = '0.5rem',
  showPercentage = false,
  className = ''
}) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={`w-full ${className}`}>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ backgroundColor, height }}
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full transition-all duration-300 ease-out rounded-full"
          style={{
            width: `${clampedProgress}%`,
            backgroundColor: color
          }}
        />
      </div>
      {showPercentage && (
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 text-center">
          {Math.round(clampedProgress)}%
        </div>
      )}
    </div>
  );
};