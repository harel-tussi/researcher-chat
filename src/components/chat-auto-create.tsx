import { useCreateChat } from "@/api";
import { Loader } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const ChatAutoCreate = () => {
  const navigate = useNavigate();
  const { createChat } = useCreateChat({
    onSuccess: (chat) => {
      navigate(`/chat/${chat.id}`);
    },
  });

  useEffect(() => {
    createChat();
  }, [createChat]);

  return <Loader className="animate-spin" />;
};
