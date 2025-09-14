import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/queryClient';
import { 
  Play, 
  Square, 
  Download, 
  RefreshCw, 
  TestTube, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Zap,
  Activity,
  Target,
  TrendingUp,
  FileText,
  Server,
  Globe,
  Bot
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TestConfig {
  scenarios: Array<{
    name: string;
    description: string;
    requestCount: number;
    delayBetween: number;
    expectedDetection: string[];
  }>;
  testUrls: {
    amazon: string[];
    walmart: string[];
  };
}

interface TestProgress {
  currentScenario: string;
  scenarioIndex: number;
  totalScenarios: number;
  currentRequest: number;
  totalRequests: number;
}

interface TestRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  duration?: number;
  progress: TestProgress;
  results?: any[];
  error?: string;
}

interface TestResult {
  filename: string;
  timestamp: string;
  totalRequests: number;
  totalDetections: number;
  scenarios: number;
  detectionRate: string;
}

const AntiBotTestingPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUrl, setSelectedUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<'amazon' | 'walmart'>('amazon');
  const [customUrl, setCustomUrl] = useState('');
  const [activeTab, setActiveTab] = useState('quick-test');

  // Get test configuration
  const { data: config } = useQuery({
    queryKey: ['/api/antibot/test/config'],
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  // Get test status
  const { data: testStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/antibot/test/status'],
    refetchInterval: 2000 // Refresh every 2 seconds when tests are running
  });

  // Get test results history
  const { data: testResults } = useQuery({
    queryKey: ['/api/antibot/test/results']
  });

  // Get live logs
  const { data: liveLogs } = useQuery({
    queryKey: ['/api/antibot/test/live-logs'],
    refetchInterval: 3000
  });

  // Start comprehensive test suite
  const startTestSuiteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/antibot/test/start-suite');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Test Suite Started',
        description: `Test ID: ${data.testId}. ${data.estimatedDuration}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/antibot/test/status'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Start Test Suite',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Stop test suite
  const stopTestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/antibot/test/stop');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Test Suite Stopped',
        description: 'The running test suite has been stopped.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/antibot/test/status'] });
    }
  });

  // Execute single test
  const singleTestMutation = useMutation({
    mutationFn: async (data: { url: string; platform: 'amazon' | 'walmart' }) => {
      const response = await apiRequest('POST', '/api/antibot/test/single', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Test Completed',
        description: data.detection 
          ? `Detected: ${data.detection.detectionType} (${(data.detection.confidence * 100).toFixed(1)}% confidence)`
          : 'No anti-bot measures detected',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Test Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Download test result
  const downloadResult = async (filename: string) => {
    try {
      const response = await fetch(`/api/antibot/test/download/${filename}`, {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Download Started',
        description: `Downloading ${filename}`,
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Could not download the test result file',
        variant: 'destructive'
      });
    }
  };

  const handleSingleTest = () => {
    const url = customUrl || selectedUrl;
    if (!url) {
      toast({
        title: 'URL Required',
        description: 'Please select or enter a URL to test',
        variant: 'destructive'
      });
      return;
    }

    const platform = url.includes('amazon.com') ? 'amazon' : 'walmart';
    singleTestMutation.mutate({ url, platform });
  };

  const testUrls = config?.config?.testUrls || { amazon: [], walmart: [] };
  const isTestRunning = testStatus?.testRun?.status === 'running';
  const progress = testStatus?.testRun?.progress;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Anti-Bot Detection Testing</h1>
          <p className="text-muted-foreground">
            Comprehensive testing suite for anti-bot detection system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isTestRunning ? 'default' : 'secondary'} className="gap-1">
            {isTestRunning ? (
              <>
                <Activity className="w-3 h-3 animate-pulse" />
                Running
              </>
            ) : (
              <>
                <CheckCircle className="w-3 h-3" />
                Idle
              </>
            )}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchStatus();
              queryClient.invalidateQueries({ queryKey: ['/api/antibot/test/live-logs'] });
            }}
            data-testid="button-refresh-status"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="quick-test" data-testid="tab-quick-test">Quick Test</TabsTrigger>
          <TabsTrigger value="comprehensive" data-testid="tab-comprehensive">Comprehensive</TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">Results</TabsTrigger>
          <TabsTrigger value="live-logs" data-testid="tab-live-logs">Live Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="quick-test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-5 h-5" />
                Quick Single Test
              </CardTitle>
              <CardDescription>
                Test a single URL for immediate anti-bot detection feedback
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={selectedPlatform} onValueChange={(value: 'amazon' | 'walmart') => setSelectedPlatform(value)}>
                    <SelectTrigger data-testid="select-platform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amazon">Amazon</SelectItem>
                      <SelectItem value="walmart">Walmart</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Pre-configured URLs</Label>
                  <Select value={selectedUrl} onValueChange={setSelectedUrl}>
                    <SelectTrigger data-testid="select-url">
                      <SelectValue placeholder="Select a test URL" />
                    </SelectTrigger>
                    <SelectContent>
                      {testUrls[selectedPlatform]?.map((url: string, index: number) => (
                        <SelectItem key={index} value={url}>
                          {url.length > 50 ? `${url.substring(0, 47)}...` : url}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Custom URL (optional)</Label>
                <Input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://www.amazon.com/dp/B08N5WRWNW"
                  data-testid="input-custom-url"
                />
              </div>

              <Button
                onClick={handleSingleTest}
                disabled={singleTestMutation.isPending}
                className="w-full"
                data-testid="button-run-single-test"
              >
                {singleTestMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Test
                  </>
                )}
              </Button>

              {singleTestMutation.data && (
                <Alert>
                  <Shield className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Test Result:</strong> {singleTestMutation.data.detection ? (
                      <>
                        Detected {singleTestMutation.data.detection.detectionType} protection 
                        ({(singleTestMutation.data.detection.confidence * 100).toFixed(1)}% confidence)
                        {singleTestMutation.data.detection.suggestedAction && (
                          <div className="mt-2 text-sm">
                            <strong>Suggested Action:</strong> {singleTestMutation.data.detection.suggestedAction}
                          </div>
                        )}
                      </>
                    ) : (
                      'No anti-bot measures detected'
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comprehensive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Comprehensive Test Suite
              </CardTitle>
              <CardDescription>
                Run the full anti-bot detection test suite across multiple scenarios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {config?.config?.scenarios && (
                <div className="space-y-3">
                  <Label>Test Scenarios</Label>
                  {config.config.scenarios.map((scenario: any, index: number) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{scenario.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</h4>
                        <Badge variant="outline">{scenario.requestCount} requests</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{scenario.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {scenario.expectedDetection.map((detection: string) => (
                          <Badge key={detection} variant="secondary" className="text-xs">
                            {detection.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isTestRunning && progress && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Test Progress</Label>
                    <span className="text-sm text-muted-foreground">
                      Scenario {progress.scenarioIndex + 1} of {progress.totalScenarios}
                    </span>
                  </div>
                  <Progress 
                    value={(progress.scenarioIndex / progress.totalScenarios) * 100} 
                    className="w-full"
                  />
                  <div className="text-sm text-muted-foreground">
                    Current: {progress.currentScenario.replace(/_/g, ' ')}
                    <br />
                    Request {progress.currentRequest} of {progress.totalRequests}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => startTestSuiteMutation.mutate()}
                  disabled={startTestSuiteMutation.isPending || isTestRunning}
                  className="flex-1"
                  data-testid="button-start-comprehensive-test"
                >
                  {startTestSuiteMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : isTestRunning ? (
                    <>
                      <Activity className="w-4 h-4 mr-2 animate-pulse" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Test Suite
                    </>
                  )}
                </Button>

                {isTestRunning && (
                  <Button
                    variant="outline"
                    onClick={() => stopTestMutation.mutate()}
                    disabled={stopTestMutation.isPending}
                    data-testid="button-stop-test"
                  >
                    <Square className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {testStatus?.testRun?.status === 'completed' && testStatus.testRun.results && (
                <Alert>
                  <CheckCircle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Test Suite Completed!</strong> 
                    <br />
                    Duration: {Math.round((testStatus.testRun.duration || 0) / 1000)}s
                    <br />
                    Results: {testStatus.testRun.results.length} scenarios completed
                  </AlertDescription>
                </Alert>
              )}

              {testStatus?.testRun?.error && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Test Failed:</strong> {testStatus.testRun.error}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Test Results History
              </CardTitle>
              <CardDescription>
                Download and review previous test results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testResults?.results?.length > 0 ? (
                <div className="space-y-3">
                  {testResults.results.map((result: TestResult, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium">Test Run {new Date(result.timestamp).toLocaleDateString()}</h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(result.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadResult(result.filename)}
                            data-testid={`button-download-${index}`}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Report
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadResult(result.filename.replace('.md', '.json'))}
                            data-testid={`button-download-json-${index}`}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            JSON
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Requests:</span>
                          <br />
                          <span className="font-medium">{result.totalRequests}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Detections:</span>
                          <br />
                          <span className="font-medium">{result.totalDetections}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Rate:</span>
                          <br />
                          <Badge variant="secondary">{result.detectionRate}</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Scenarios:</span>
                          <br />
                          <span className="font-medium">{result.scenarios}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No test results available. Run a comprehensive test to generate results.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live-logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Live Detection Logs
              </CardTitle>
              <CardDescription>
                Real-time anti-bot detection events and system logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 w-full border rounded-lg p-4">
                {liveLogs?.logs?.length > 0 ? (
                  <div className="space-y-2">
                    {liveLogs.logs.map((log: any, index: number) => (
                      <div key={index} className="text-sm font-mono">
                        <span className="text-muted-foreground">
                          [{new Date(log.timestamp).toLocaleTimeString()}]
                        </span>
                        <span className="ml-2">{log.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    No recent detection events. Run tests to generate logs.
                  </div>
                )}
              </ScrollArea>
              <div className="mt-4 text-xs text-muted-foreground">
                Last updated: {liveLogs?.timestamp ? new Date(liveLogs.timestamp).toLocaleTimeString() : 'Never'}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AntiBotTestingPage;