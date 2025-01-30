'use client';

import {useTranslations} from 'next-intl';
import {Link, routes} from '@/navigation';
import {useState, useEffect, useMemo, useCallback, useRef} from 'react';
import {PageWrapper} from '@/components/ui/PageWrapper';
import {Card, CardHeader, CardTitle, CardDescription, CardContent} from '@/components/ui/Card';
import {useAssessment} from '@/context/AssessmentContext';
import {
  AirtableService,
  CategoryWithQuestions,
  MethodQuestion,
  MethodAnswer,
  CompanyType,
  CompanyTypeMapping
} from '@/services/airtable';
import {AnswerOption} from '@/components/ui/AnswerOption';
import {ChevronLeft, ChevronRight, WifiOff} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { useSync } from '@/lib/sync';
import { SyncStatus } from '@/components/ui/SyncStatus';

type AssessmentQuestion = {
  categoryId: string;
  question: MethodQuestion;
  answers: MethodAnswer[];
};

export default function AssessmentPage() {
  const t = useTranslations();
  const {state, setAnswer} = useAssessment();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessmentStructure, setAssessmentStructure] = useState<CategoryWithQuestions[]>([]);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Use our sync hook for answers
  const { 
    data: answers = {}, // Provide default empty object
    updateData: setAnswers,
    isOffline,
    syncStatus,
    syncData
  } = useSync<Record<string, string>>({
    key: 'assessment_answers',
    initialData: {},
    onSync: async (data) => {
      // Only sync if we have answers
      if (Object.keys(data).length > 0) {
        // Replace with your actual API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Sync with context
        Object.entries(data).forEach(([questionId, answerId]) => {
          setAnswer(questionId, answerId);
        });
      }
    }
  });

  useEffect(() => {
    async function loadAssessmentData() {
      try {
        console.log('Starting to load assessment data');
        const formCompanyType = state.formData.companyType;
        console.log('Form company type:', formCompanyType);
        
        if (!formCompanyType) {
          // Instead of throwing an error, wait for a short time and check again
          // This gives time for the data to load from localStorage
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryCompanyType = state.formData.companyType;
          if (!retryCompanyType) {
            throw new Error('Company type not selected');
          }
        }

        const mappedCompanyType = CompanyTypeMapping[formCompanyType as keyof typeof CompanyTypeMapping];
        console.log('Mapped company type:', mappedCompanyType);
        
        setIsLoading(true);
        setError(null);
        
        // Get assessment structure for the company type
        const structure = await AirtableService.getAssessmentStructure(mappedCompanyType);
        console.log('Received structure:', structure);
        setAssessmentStructure(structure);

        // Transform structure into flat list of questions
        const allQuestions: AssessmentQuestion[] = [];
        const seenQuestionIds = new Set<string>(); // Track seen question IDs

        for (const category of structure) {
          console.log(`Processing category: ${category.category.categoryId}`);
          console.log('Questions in category:', category.questions);
          
          for (const question of category.questions) {
            if (seenQuestionIds.has(question.questionId)) {
              console.warn(`Duplicate question ID found: ${question.questionId}`);
              continue; // Skip duplicate questions
            }
            
            seenQuestionIds.add(question.questionId);
            console.log(`Processing question: ${question.questionId}`);
            console.log('Available answers:', category.answers[question.questionId]);
            
            allQuestions.push({
              categoryId: category.category.categoryId,
              question,
              answers: category.answers[question.questionId] || []
            });
          }
        }
        
        // Sort questions by their ID to ensure consistent order
        allQuestions.sort((a, b) => {
          const aNum = parseInt(a.question.questionId.replace('Q', ''));
          const bNum = parseInt(b.question.questionId.replace('Q', ''));
          return aNum - bNum;
        });
        
        console.log('Final questions array:', allQuestions);
        setQuestions(allQuestions);
      } catch (err) {
        console.error('Error loading assessment data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load assessment data');
      } finally {
        setIsLoading(false);
      }
    }

    loadAssessmentData();
  }, [state.formData.companyType]);

  // Load cached answers from localStorage
  useEffect(() => {
    const cachedAnswers = localStorage.getItem('assessment_answers');
    if (cachedAnswers) {
      const parsed = JSON.parse(cachedAnswers);
      setAnswers(parsed);
      // Replay cached answers to context
      Object.entries(parsed).forEach(([questionId, answerId]) => {
        if (typeof answerId === 'string') {
          setAnswer(questionId, answerId);
        }
      });
    }
  }, [setAnswer]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      // Online status is now handled by useSync
    };
    
    const handleOffline = () => {
      // Offline status is now handled by useSync
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Add logging for render-time variables
  console.log('Current render state:', {
    isLoading,
    error,
    questionsCount: questions.length,
    currentQuestionIndex,
    currentQuestion: questions[currentQuestionIndex],
    progress: questions.length > 0 ? (currentQuestionIndex / questions.length) * 100 : 0
  });

  const currentQuestion = questions[currentQuestionIndex];
  const progressPercentage = (Object.keys(answers).length / questions.length) * 100;

  // Calculate category-specific progress
  const getCategoryProgress = (categoryId: string) => {
    const categoryQuestions = questions.filter(q => q.categoryId === categoryId);
    const answeredInCategory = categoryQuestions.filter(q => answers[q.question.questionId]).length;
    return {
      total: categoryQuestions.length,
      answered: answeredInCategory,
      progress: categoryQuestions.length > 0 ? (answeredInCategory / categoryQuestions.length) * 100 : 0
    };
  };

  // Get unique categories and their progress
  const categories = Array.from(new Set(questions.map(q => q.categoryId))).map(categoryId => ({
    categoryId,
    ...getCategoryProgress(categoryId)
  }));

  // Get current category progress
  const currentCategoryProgress = currentQuestion ? getCategoryProgress(currentQuestion.categoryId) : null;

  // Function to shuffle array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Memoize shuffled answers for each question
  const shuffledAnswers = useMemo(() => {
    const shuffled = new Map<string, MethodAnswer[]>();
    questions.forEach(q => {
      shuffled.set(q.question.questionId, shuffleArray(q.answers));
    });
    return shuffled;
  }, [questions]);

  const handleAnswer = (questionId: string, answerId: string) => {
    const newAnswers = {...answers, [questionId]: answerId};
    setAnswers(newAnswers);
    setAnswer(questionId, answerId);
    setShowError(false);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev - 1);
        setSelectedAnswer(answers[questions[currentQuestionIndex - 1].question.questionId] || null);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(answers[questions[currentQuestionIndex + 1].question.questionId] || null);
        setIsTransitioning(false);
      }, 300);
    } else {
      // This is the last question and it's answered, navigate to results
      window.location.href = routes.results;
    }
  };

  const handleAnswerSelect = (answerId: string) => {
    try {
      // Save the answer
      setSelectedAnswer(answerId);
      const newAnswers = {
        ...answers,
        [questions[currentQuestionIndex].question.questionId]: answerId
      };
      setAnswers(newAnswers); // This will trigger sync automatically
      setAnswer(questions[currentQuestionIndex].question.questionId, answerId);

      // Auto-advance with animation
      if (currentQuestionIndex < questions.length - 1) {
        setIsTransitioning(true);
        setTimeout(() => {
          setCurrentQuestionIndex(prev => prev + 1);
          setSelectedAnswer(answers[questions[currentQuestionIndex + 1]?.question.questionId] || null);
          setIsTransitioning(false);
        }, 300);
      } else {
        // If this is the last question, sync and then navigate
        syncData().then(() => {
          window.location.href = routes.results;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save answer');
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <LoadingSpinner size="lg" />
        <p className="loading-text">Loading assessment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <PageWrapper>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-semibold mb-4 text-red-500">{t('common.error')}</div>
            <div className="text-gray-400">{error}</div>
            <Link
              href={routes.setup}
              className="mt-6 inline-block px-6 py-2 bg-gray-800 text-white font-medium 
                hover:bg-gray-700 transition-colors"
            >
              {t('nav.back')}
            </Link>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 animate-fade">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Error Message */}
        {error && (
          <ErrorMessage 
            message={error}
            className="animate-shake"
          />
        )}

        {/* Progress Section */}
        <div className="space-y-4 animate-slide-down">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">
              Question {currentQuestionIndex + 1} of {questions.length}
            </h2>
            <span className="text-primary font-medium">
              {Math.round(progressPercentage)}%
            </span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF6600] to-[#FFCC00] transition-all duration-500 ease-out"
              style={{
                width: `${progressPercentage}%`,
              }}
              role="progressbar"
              aria-valuenow={progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Question Section */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg p-6 space-y-6 animate-scale border border-gray-700">
          <h1 className="text-2xl font-bold text-white">{currentQuestion.question.questionText}</h1>
          
          {showError && (
            <ErrorMessage 
              message="Please select an answer before proceeding"
              className="mb-4"
            />
          )}
          
          <div 
            className="space-y-4"
            role="radiogroup"
            aria-labelledby="question-options"
          >
            {shuffledAnswers.get(currentQuestion.question.questionId)?.map((answer, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(answer.answerId)}
                className={cn(
                  'w-full p-4 text-left rounded-lg transition-standard hover-lift',
                  'border-2 focus:outline-none focus:ring-2 focus:ring-primary/50',
                  'text-white',
                  selectedAnswer === answer.answerId
                    ? 'border-primary bg-primary/20'
                    : 'border-gray-700 bg-gray-800/30 hover:border-primary/30 hover:bg-gray-800/50'
                )}
                role="radio"
                aria-checked={selectedAnswer === answer.answerId}
                tabIndex={0}
              >
                {answer.answerText}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex justify-between items-center animate-slide-up">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className={cn(
              'px-6 py-2 rounded-lg transition-standard',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              currentQuestionIndex === 0
                ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
                : 'bg-gray-800 hover:bg-gray-700 text-white'
            )}
          >
            Previous
          </button>
          
          {currentQuestionIndex === questions.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!selectedAnswer}
              className={cn(
                'px-6 py-2 rounded-lg transition-standard',
                'focus:outline-none focus:ring-2 focus:ring-primary/50',
                !selectedAnswer
                  ? 'bg-primary/30 text-white/50 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/90 text-white',
                'font-medium'
              )}
            >
              View Results
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
} 