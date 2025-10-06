import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  GraduationCap, 
  BookOpen, 
  Lightbulb, 
  Play, 
  Check, 
  Lock,
  ChevronRight,
  Star,
  Shield,
  Users
} from "lucide-react";
import ChessBoard from "@/components/ChessBoard";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useEffect } from "react";

export default function Tutorial() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  const { data: lessons = [] } = useQuery({
    queryKey: ["/api/tutorial/lessons"],
    retry: false,
  });

  const { data: progress = [] } = useQuery({
    queryKey: ["/api/tutorial/progress"],
    retry: false,
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ lessonId, completed, score }: { lessonId: number; completed: boolean; score?: number }) => {
      return await apiRequest('POST', '/api/tutorial/progress', {
        lessonId,
        completed,
        score,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/progress"] });
      toast({
        title: "Progress Updated!",
        description: "Lesson progress has been saved.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update progress. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [user, isLoading, toast]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Mock data for tutorial structure since we don't have seeded lessons
  const mockLessons = [
    { id: 1, title: "Basic Piece Movement", category: "rules", completed: true },
    { id: 2, title: "Castling", category: "rules", completed: true },
    { id: 3, title: "En Passant", category: "rules", completed: false },
    { id: 4, title: "Checkmate Patterns", category: "rules", completed: false },
  ];

  const completedLessons = mockLessons.filter(lesson => lesson.completed).length;
  const totalLessons = mockLessons.length;
  const progressPercentage = (completedLessons / totalLessons) * 100;

  const strategyTips = [
    {
      icon: Star,
      title: "Control the Center",
      description: "Place pawns and pieces to control central squares d4, d5, e4, e5"
    },
    {
      icon: Shield,
      title: "King Safety",
      description: "Castle early to protect your king and connect your rooks"
    },
    {
      icon: Users,
      title: "Develop Pieces",
      description: "Bring knights and bishops into the game before moving the same piece twice"
    }
  ];

  const handleLessonComplete = (lessonId: number) => {
    updateProgressMutation.mutate({
      lessonId,
      completed: true,
      score: 100,
    });
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="px-4 pt-12 pb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
            <GraduationCap className="text-white" size={20} />
          </div>
          <h1 className="text-2xl font-bold">Learn Chess</h1>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* Progress Overview */}
        <Card className="bg-gradient-to-r from-green-600 to-emerald-600 border-0">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">Your Progress</h3>
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Lessons Completed</span>
              <span>{completedLessons} / {totalLessons}</span>
            </div>
            <Progress value={progressPercentage} className="h-2 bg-black/20" />
          </CardContent>
        </Card>

        {/* Chess Rules Section */}
        <Card className="bg-slate-800 border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold flex items-center">
              <BookOpen className="text-blue-400 mr-2" size={16} />
              Chess Rules
            </h3>
          </div>
          <div className="divide-y divide-slate-700">
            {mockLessons.map((lesson, index) => {
              const isCompleted = lesson.completed;
              const isLocked = index > 0 && !mockLessons[index - 1].completed;
              
              return (
                <div key={lesson.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-emerald-500' : 
                      isLocked ? 'bg-slate-600' : 'bg-blue-500'
                    }`}>
                      {isCompleted ? (
                        <Check className="text-white" size={12} />
                      ) : isLocked ? (
                        <Lock className="text-slate-400" size={12} />
                      ) : (
                        <span className="text-white text-xs font-bold">{index + 1}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{lesson.title}</p>
                      <p className="text-slate-400 text-xs">
                        {isCompleted ? 'Completed' : 
                         isLocked ? 'Complete previous lesson to unlock' : 
                         'Ready to start'}
                      </p>
                    </div>
                  </div>
                  {!isLocked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => !isCompleted && handleLessonComplete(lesson.id)}
                      disabled={isCompleted || updateProgressMutation.isPending}
                    >
                      {isCompleted ? <Check size={16} /> : <ChevronRight size={16} />}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Strategy Tips */}
        <Card className="bg-slate-800 border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold flex items-center">
              <Lightbulb className="text-yellow-400 mr-2" size={16} />
              Strategy Tips
            </h3>
          </div>
          <div className="divide-y divide-slate-700">
            {strategyTips.map((tip, index) => {
              const Icon = tip.icon;
              
              return (
                <div key={index} className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="text-white" size={12} />
                    </div>
                    <div>
                      <p className="font-medium text-sm mb-1">{tip.title}</p>
                      <p className="text-slate-400 text-xs">{tip.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Interactive Lessons */}
        <Card className="bg-slate-800 border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold flex items-center">
              <Play className="text-green-400 mr-2" size={16} />
              Interactive Lessons
            </h3>
          </div>
          
          {/* Mini Chess Board Example */}
          <div className="p-4 border-b border-slate-700">
            <p className="text-sm mb-3 text-slate-300">Practice Lesson: Scholar's Mate Defense</p>
            <ChessBoard size="small" />
            <p className="text-xs text-slate-400 mt-3 text-center">
              Move your knight to defend against the early queen attack
            </p>
          </div>
          
          <div className="p-4">
            <Button className="w-full bg-green-500 hover:bg-green-600">
              Start Interactive Lesson
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
