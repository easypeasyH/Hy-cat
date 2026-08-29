import { createContext, useContext } from 'react';

interface AppContextType {
  config: AppConfig | null;
  updateConfig: (partial: Partial<AppConfig>) => Promise<void>;
}

export const AppContext = createContext<AppContextType>({
  config: null,
  updateConfig: async () => {},
});

export const useAppContext = () => useContext(AppContext);

interface AppConfig {
  apiKey: string;
  modelName: string;
  petSize: number;
  petOpacity: number;
  firstRun: boolean;
}

