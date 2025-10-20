import { ReactNode } from "react";

interface A4LayoutProps {
  children: ReactNode;
  className?: string;
}

export function A4Layout({ children, className = "" }: A4LayoutProps) {
  return (
    <div className={`min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4 ${className}`} data-testid="a4-layout-container">
      <div className="max-w-[210mm] mx-auto">
        {children}
      </div>
    </div>
  );
}

interface A4PageProps {
  children: ReactNode;
  pageNumber?: number;
  showPageBreak?: boolean;
}

export function A4Page({ children, pageNumber, showPageBreak = false }: A4PageProps) {
  return (
    <>
      <div 
        className="bg-white dark:bg-gray-800 shadow-lg mb-6 rounded-sm"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '25mm 20mm',
          position: 'relative'
        }}
        data-testid={`a4-page${pageNumber ? `-${pageNumber}` : ''}`}
      >
        {children}
        
        {pageNumber && (
          <div 
            className="absolute bottom-4 right-8 text-sm text-gray-400"
            data-testid={`page-number-${pageNumber}`}
          >
            {pageNumber}
          </div>
        )}
      </div>
      
      {showPageBreak && (
        <div 
          className="flex items-center justify-center my-4"
          data-testid="page-break-indicator"
        >
          <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
          <span className="px-4 text-xs text-gray-500 dark:text-gray-400">
            Pagina-einde
          </span>
          <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
        </div>
      )}
    </>
  );
}

interface SectionHeadingProps {
  children: ReactNode;
  level?: 1 | 2 | 3;
  className?: string;
}

export function SectionHeading({ children, level = 1, className = "" }: SectionHeadingProps) {
  const baseClasses = "font-bold text-gray-900 dark:text-white mb-4";
  const levelClasses = {
    1: "text-2xl",
    2: "text-xl",
    3: "text-lg"
  };
  
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  
  return (
    <Tag className={`${baseClasses} ${levelClasses[level]} ${className}`}>
      {children}
    </Tag>
  );
}

interface SectionBodyProps {
  children: ReactNode;
  className?: string;
}

export function SectionBody({ children, className = "" }: SectionBodyProps) {
  return (
    <div className={`text-base leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap ${className}`}>
      {children}
    </div>
  );
}
