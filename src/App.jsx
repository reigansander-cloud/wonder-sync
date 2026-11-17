import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import { BASE_PATH } from '@/lib/appUrl';
import Home from './pages/Home';
import CardLibrary from './pages/CardLibrary';
import CardEditor from './pages/CardEditor';
import Lobby from './pages/Lobby';
import GameRoom from './pages/GameRoom';
import ChainSymbols from './pages/ChainSymbols';
import Wonders from './pages/Wonders';
import WonderEditor from './pages/WonderEditor';
import Edifices from './pages/Edifices';

// No sign-in: anyone with the link can play, same as the Base44 version.
function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router basename={BASE_PATH || undefined}>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cards" element={<CardLibrary />} />
          <Route path="/cards/new" element={<CardEditor />} />
          <Route path="/cards/:id/edit" element={<CardEditor />} />
          <Route path="/lobby/:code" element={<Lobby />} />
          <Route path="/game/:code" element={<GameRoom />} />
          <Route path="/chain-symbols" element={<ChainSymbols />} />
          <Route path="/wonders" element={<Wonders />} />
          <Route path="/wonders/new" element={<WonderEditor />} />
          <Route path="/wonders/:id/edit" element={<WonderEditor />} />
          <Route path="/edifices" element={<Edifices />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
