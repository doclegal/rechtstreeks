interface RIconProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function RIcon({ className = '', size = 'md' }: RIconProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const fontSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg'
  };

  return (
    <div className={`${sizeClasses[size]} ${className} rounded-full bg-foreground flex items-center justify-center`}>
      <span className={`${fontSizes[size]} font-bold text-background`}>R</span>
    </div>
  );
}
