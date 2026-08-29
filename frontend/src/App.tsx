import { BrowserRouter, Route, Routes } from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import DashboardPage from "./pages/DashboardPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/dashboard/:traceId" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
