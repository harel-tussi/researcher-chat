import { Routes, Route } from "react-router-dom";
import { ChatAppComponent } from "./components/chat-app";
import { ChatAutoCreate } from "./components/chat-auto-create";

function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatAutoCreate />} />
      <Route path="/chat/:chatId" element={<ChatAppComponent />} />
    </Routes>
  );
}

export default App;
