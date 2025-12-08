import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { AppProvider } from '@/context/AppContext';
import { BrowserRouter } from 'react-router-dom';

interface WrapperProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: WrapperProps) => {
  return (
    <BrowserRouter>
      <AppProvider>
        {children}
      </AppProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
