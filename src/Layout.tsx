import { ReactNode } from 'react';

import Navbar from './components/Navbar';

interface Props {
  children: ReactNode;
}

export const PageLayout = ({ children }: Props) => {
  return (
    <div
      // eslint-disable-next-line react/no-unknown-property
      vaul-drawer-wrapper=""
      className="flex min-h-screen w-full flex-col"
    >
      <Navbar />
      <div
        className="flex w-full grow items-center justify-center bg-neutral-100 
      dark:bg-black"
      >
        {children}
      </div>
    </div>
  );
};
