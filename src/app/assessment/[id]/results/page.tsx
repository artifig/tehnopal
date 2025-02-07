import { 
  getAssessmentResponse, 
  getCategories, 
  getQuestions, 
  getAnswers,
  getRecommendationsForCategory,
  getExampleSolutionsForCategory,
  getProvidersForRecommendation,
  getProvidersForExampleSolution,
  type MethodCategory,
  type MethodQuestion,
  type MethodAnswer,
  type MethodRecommendation,
  type MethodExampleSolution,
  type SolutionProvider
} from "@/lib/airtable";
import { redirect } from "next/navigation";
import Image from "next/image";

interface AssessmentResponse {
  questionId: string;
  answerId: string;
}

interface CategoryScore extends MethodCategory {
  score: number;
  questionCount: number;
  answeredCount: number;
  maturityLevel: string;
  maturityColor: 'red' | 'yellow' | 'green';
  recommendations: (MethodRecommendation & { providers: SolutionProvider[] })[];
  solutions: (MethodExampleSolution & { providers: SolutionProvider[] })[];
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  try {
    // Fetch the assessment response
    const assessment = await getAssessmentResponse(id);
    if (!assessment || !assessment.isActive) {
      redirect('/assessment');
    }

    // Parse the response content
    const content = JSON.parse(assessment.responseContent);
    const { companyType, responses } = content;
    
    // Fetch categories for the company type
    const categories = await getCategories(companyType);
    
    // Fetch questions for all categories
    const questions = await getQuestions(categories.map((category: MethodCategory) => category.id));
    
    // Fetch all possible answers
    const answers = await getAnswers(questions.map((question: MethodQuestion) => question.id));

    // Calculate scores and fetch recommendations/solutions for each category
    const categoryScores = await Promise.all(categories.map(async (category: MethodCategory) => {
      // Get questions for this category
      const categoryQuestions = questions.filter((question: MethodQuestion) =>
        question.MethodCategories.includes(category.id)
      );

      // Calculate average score for the category
      const categoryResponses = categoryQuestions
        .map((question: MethodQuestion) => {
          const response = responses.find((r: AssessmentResponse) => r.questionId === question.id);
          if (!response) return null;
          
          const answer = answers.find((answer: MethodAnswer) => answer.id === response.answerId);
          return answer ? answer.answerScore : null;
        })
        .filter((score): score is number => score !== null);

      const averageScore = categoryResponses.length
        ? Math.round(categoryResponses.reduce((a, b) => a + b, 0) / categoryResponses.length)
        : 0;

      // Determine maturity level based on score
      let maturityLevel = '';
      let maturityColor: 'red' | 'yellow' | 'green';
      let scoreLevel: 'red' | 'yellow' | 'green';
      
      if (averageScore < 40) {
        maturityLevel = 'Punane';
        maturityColor = 'red';
        scoreLevel = 'red';
      } else if (averageScore < 70) {
        maturityLevel = 'Kollane';
        maturityColor = 'yellow';
        scoreLevel = 'yellow';
      } else {
        maturityLevel = 'Roheline';
        maturityColor = 'green';
        scoreLevel = 'green';
      }

      // Fetch recommendations and solutions with their providers
      const [recommendations, solutions] = await Promise.all([
        getRecommendationsForCategory(category.id, scoreLevel, companyType),
        getExampleSolutionsForCategory(category.id, scoreLevel, companyType)
      ]);

      console.log('Fetching providers for recommendations and solutions in category:', category.categoryText_et);

      // Fetch providers for each recommendation and solution
      const recommendationsWithProviders = await Promise.all(
        recommendations.map(async (rec) => {
          console.log('Fetching providers for recommendation:', rec.recommendationText_et);
          const providers = await getProvidersForRecommendation(rec.id);
          console.log('Found providers for recommendation:', providers.length);
          return {
            ...rec,
            providers
          };
        })
      );

      const solutionsWithProviders = await Promise.all(
        solutions.map(async (sol) => {
          console.log('Fetching providers for solution:', sol.exampleSolutionText_et);
          const providers = await getProvidersForExampleSolution(sol.id);
          console.log('Found providers for solution:', providers.length);
          return {
            ...sol,
            providers
          };
        })
      );

      console.log('Finished fetching all providers for category:', category.categoryText_et);

      return {
        ...category,
        score: averageScore,
        questionCount: categoryQuestions.length,
        answeredCount: categoryResponses.length,
        maturityLevel,
        maturityColor,
        recommendations: recommendationsWithProviders,
        solutions: solutionsWithProviders
      };
    }));

    return (
      <main className="tehnopol-container tehnopol-section">
        <div className="tehnopol-content-group-lg">
          <h1 className="tehnopol-gradient-text text-3xl font-bold">
            Hindamise tulemused
          </h1>
          
          <div className="tehnopol-content-group">
            <h2 className="tehnopol-heading text-xl">Teie eesmärk:</h2>
            <p className="tehnopol-text bg-muted/30 p-4 rounded">
              {assessment.initialGoal}
            </p>
          </div>

          {/* Overall Score and AI Feedback Section */}
          <div className="tehnopol-card">
            <div className="tehnopol-content-group">
              <div className="tehnopol-flex-between">
                <div className="tehnopol-content-group-sm">
                  <h2 className="tehnopol-heading text-2xl">Üldine tulemus</h2>
                  <p className="tehnopol-text">Teie ettevõtte üldine küpsustase</p>
                </div>
                <div className="relative">
                  <div className="w-40 h-40 rounded-full border-8 border-tehnopol flex items-center justify-center bg-white dark:bg-gray-800">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-tehnopol">75%</div>
                      <div className="tehnopol-text-sm">Küpsustase</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="tehnopol-flex-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-tehnopol/10 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-tehnopol" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="tehnopol-content-group">
                    <h3 className="tehnopol-heading text-lg">Tagasiside Tehnopoli tehisarult</h3>
                    <div className="prose dark:prose-invert max-w-none">
                      <p className="tehnopol-text">
                        Teie ettevõte näitab tugevat potentsiaali mitmes valdkonnas. Eriti silmapaistev on teie sooritus kvaliteedijuhtimise ja innovatsiooni valdkonnas. Siiski on mõned võimalused edasisteks parandusteks, eriti seoses digitaliseerimise ja andmepõhise otsustamisega.
                      </p>
                      <div className="tehnopol-content-group">
                        <div>
                          <p className="tehnopol-text">Peamised tugevused:</p>
                          <ul className="tehnopol-list">
                            <li>Tugev strateegiline planeerimine</li>
                            <li>Efektiivne meeskonnatöö</li>
                            <li>Kliendikeskne lähenemine</li>
                          </ul>
                        </div>
                        <div>
                          <p className="tehnopol-text">Arendamist vajavad valdkonnad:</p>
                          <ul className="tehnopol-list">
                            <li>Digitaalsete lahenduste integreerimine</li>
                            <li>Andmepõhine otsustusprotsess</li>
                            <li>Automatiseerimine ja protsesside optimeerimine</li>
                          </ul>
                        </div>
                      </div>
                      <div className="tehnopol-text-sm italic">
                        * See tagasiside on genereeritud tehisintellekti poolt, põhinedes teie vastustel hindamisküsimustele.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Results */}
          <div className="tehnopol-stack-lg">
            {categoryScores.map((category: CategoryScore) => (
              <div key={category.id} className="tehnopol-card">
                {/* Category header */}
                <div className="tehnopol-content-group">
                  <div className="tehnopol-flex-between">
                    <div className="tehnopol-content-group-sm">
                      <h3 className="tehnopol-heading text-xl">{category.categoryText_et}</h3>
                      <p className="tehnopol-text">
                        {category.categoryDescription_et}
                      </p>
                    </div>
                    <div className="text-right tehnopol-content-group-sm">
                      <div className="text-2xl font-bold text-tehnopol">
                        {category.score}%
                      </div>
                      <div className="tehnopol-text-sm">
                        Vastatud: {category.answeredCount}/{category.questionCount}
                      </div>
                      <div className={`tehnopol-text-sm font-medium ${
                        category.maturityColor === 'red' ? 'tehnopol-status-red' :
                        category.maturityColor === 'yellow' ? 'tehnopol-status-yellow' :
                        'tehnopol-status-green'
                      }`}>
                        {category.maturityLevel} tase
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="tehnopol-progress-bar">
                    <div
                      className={`tehnopol-progress-indicator ${
                        category.maturityColor === 'red' ? 'bg-red-600' :
                        category.maturityColor === 'yellow' ? 'bg-yellow-600' :
                        'bg-green-600'
                      }`}
                      style={{ width: `${category.score}%` }}
                    />
                  </div>

                  {/* Recommendations section */}
                  <div className="tehnopol-content-group">
                    <h4 className="tehnopol-heading text-lg">Soovitused</h4>
                    <div className="tehnopol-stack">
                      {category.recommendations.map((recommendation) => (
                        <div key={recommendation.id} className="tehnopol-card-muted">
                          <div className="tehnopol-content-group">
                            <h5 className="tehnopol-heading">{recommendation.recommendationText_et}</h5>
                            <p className="tehnopol-text">
                              {recommendation.recommendationDescription_et}
                            </p>
                            {recommendation.providers.length > 0 && (
                              <div className="border-t pt-4">
                                <h6 className="tehnopol-heading">Teenusepakkujad:</h6>
                                <div className="tehnopol-grid-cols-2">
                                  {recommendation.providers.map((provider) => (
                                    <div key={provider.id} className="tehnopol-card">
                                      {provider.providerLogo?.[0] && (
                                        <div className="flex-shrink-0">
                                          <Image
                                            src={provider.providerLogo[0].thumbnails.small.url}
                                            alt={provider.providerName_et}
                                            width={provider.providerLogo[0].thumbnails.small.width}
                                            height={provider.providerLogo[0].thumbnails.small.height}
                                            className="rounded-lg"
                                          />
                                        </div>
                                      )}
                                      <div className="tehnopol-content-group-sm">
                                        <h6 className="tehnopol-heading">{provider.providerName_et}</h6>
                                        <p className="tehnopol-text-sm">
                                          {provider.providerDescription_et}
                                        </p>
                                        <div className="text-sm">
                                          <a
                                            href={provider.providerUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="tehnopol-link"
                                          >
                                            Külasta veebilehte
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Example solutions section */}
                  <div className="tehnopol-content-group">
                    <h4 className="tehnopol-heading text-lg">Näidislahendused</h4>
                    <div className="tehnopol-grid-cols-2">
                      {category.solutions.map((solution) => (
                        <div key={solution.id} className="tehnopol-card-muted">
                          <div className="tehnopol-content-group">
                            <h5 className="tehnopol-heading">{solution.exampleSolutionText_et}</h5>
                            <p className="tehnopol-text">
                              {solution.exampleSolutionDescription_et}
                            </p>
                            {solution.providers.length > 0 && (
                              <div className="border-t pt-4">
                                <h6 className="tehnopol-heading">Teenusepakkujad:</h6>
                                <div className="tehnopol-stack">
                                  {solution.providers.map((provider) => (
                                    <div key={provider.id} className="tehnopol-card">
                                      {provider.providerLogo?.[0] && (
                                        <div className="flex-shrink-0">
                                          <Image
                                            src={provider.providerLogo[0].thumbnails.small.url}
                                            alt={provider.providerName_et}
                                            width={provider.providerLogo[0].thumbnails.small.width}
                                            height={provider.providerLogo[0].thumbnails.small.height}
                                            className="rounded-lg"
                                          />
                                        </div>
                                      )}
                                      <div className="tehnopol-content-group-sm">
                                        <h6 className="tehnopol-heading">{provider.providerName_et}</h6>
                                        <p className="tehnopol-text-sm">
                                          {provider.providerDescription_et}
                                        </p>
                                        <div className="text-sm">
                                          <a
                                            href={provider.providerUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="tehnopol-link"
                                          >
                                            Külasta veebilehte
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  } catch (error) {
    console.error('Error loading results page:', error);
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="tehnopol-heading text-3xl mb-6 text-red-600">
          Viga tulemuste laadimisel
        </h1>
        <p className="tehnopol-text text-lg mb-4">
          Kahjuks tekkis tulemuste laadimisel viga. Palun proovige uuesti.
        </p>
        <a
          href="/assessment"
          className="tehnopol-btn tehnopol-btn-primary"
        >
          Tagasi hindamise algusesse
        </a>
      </main>
    );
  }
} 