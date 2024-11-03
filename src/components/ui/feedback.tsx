import { Feedback as IFeedback } from "@/types";
import { Button } from "./button";

export const Feedback = ({
  feedback,
  onFeedback,
}: {
  feedback?: IFeedback;
  onFeedback: (feedback: IFeedback) => void;
}) => {
  return (
    <div className="flex gap-2">
      <Button
        variant="ghost"
        size="sm"
        className={`p-1 h-8 w-8 ${
          feedback === "good" ? "bg-green-100 hover:bg-green-200" : "hover:bg-green-50"
        }`}
        onClick={() => onFeedback("good")}
      >
        <span className="text-lg text-green-600">👍</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`p-1 h-8 w-8 ${
          feedback === "bad" ? "bg-red-100 hover:bg-red-200" : "hover:bg-red-50"
        }`}
        onClick={() => onFeedback("bad")}
      >
        <span className="text-lg text-red-600">👎</span>
      </Button>
    </div>
  );
};
