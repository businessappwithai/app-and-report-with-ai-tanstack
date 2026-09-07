import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCircle, Mail, RefreshCw, Send, Settings, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/_authed/settings/email/")({
  component: EmailSettingsPage,
});

function EmailSettingsPage() {
  const [testEmail, setTestEmail] = useState("");

  const { data: config, isLoading } = useQuery({
    queryKey: ["email-config"],
    queryFn: async () => {
      const res = await fetch("/api/settings/email");
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load email config`);
      const data = await res.json();
      return data.data;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Email configuration verified successfully");
      } else {
        toast.error(data.error?.message || "Verification failed");
      }
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", to: testEmail }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Test email sent successfully");
      } else {
        toast.error(data.error?.message || "Failed to send test email");
      }
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Email Settings"
          description="Configure email notifications for job completion"
        />
        <Button
          variant="outline"
          onClick={() => verifyMutation.mutate()}
          disabled={verifyMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${verifyMutation.isPending ? "animate-spin" : ""}`} />
          Verify Connection
        </Button>
      </div>

      <Tabs defaultValue="configuration">
        <TabsList>
          <TabsTrigger value="configuration">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Mail className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="test">
            <Send className="h-4 w-4 mr-2" />
            Test Email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>SMTP Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <p className="text-tremor-content">Loading configuration...</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Status</Label>
                        <Badge variant={config?.configured ? "default" : "secondary"}>
                          {config?.configured ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Configured
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Not Configured
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Host</Label>
                      <Input value={config?.host || ""} disabled placeholder="smtp.gmail.com" />
                      <p className="text-tremor-label text-tremor-content">
                        Set via SMTP_HOST environment variable
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Port</Label>
                      <Input value={config?.port || ""} disabled placeholder="587" />
                      <p className="text-tremor-label text-tremor-content">
                        Set via SMTP_PORT environment variable
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Use SSL/TLS</Label>
                        <p className="text-tremor-label text-tremor-content">
                          Enable secure connection
                        </p>
                      </div>
                      <Switch checked={config?.secure} disabled />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sender Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <p className="text-tremor-content">Loading configuration...</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>From Email</Label>
                      <Input
                        value={config?.from || ""}
                        disabled
                        placeholder="noreply@example.com"
                      />
                      <p className="text-tremor-label text-tremor-content">
                        Set via EMAIL_FROM environment variable
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>From Name</Label>
                      <Input
                        value={config?.fromName || ""}
                        disabled
                        placeholder="Enterprise Reporting System"
                      />
                      <p className="text-tremor-label text-tremor-content">
                        Set via EMAIL_FROM_NAME environment variable
                      </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className="font-medium text-sm mb-2">📧 Configuration Instructions</h4>
                      <ol className="text-xs space-y-1 list-decimal list-inside text-muted-foreground">
                        <li>Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your .env file</li>
                        <li>Set EMAIL_FROM and optionally EMAIL_FROM_NAME</li>
                        <li>For Gmail, use an App Password: enable 2FA → generate App Password</li>
                        <li>For Outlook, use SMTP with your Microsoft account</li>
                        <li>Click &ldquo;Verify Connection&rdquo; to test your configuration</li>
                      </ol>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Connection Pooling</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Email sending uses connection pooling for improved performance:
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { value: "5", label: "Max Connections" },
                  { value: "100", label: "Max Messages per Connection" },
                  { value: "∞", label: "Automatic Reuse" },
                ].map(({ value, label }) => (
                  <div key={label} className="bg-muted p-4 rounded-lg">
                    <p className="font-semibold text-tremor-metric text-tremor-content-strong">
                      {value}
                    </p>
                    <p className="text-tremor-label text-tremor-content">{label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Available Email Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      icon: <Bell className="h-4 w-4" />,
                      title: "Job Completed Notification",
                      badge: "Auto-sent",
                      desc: "Sent when a scheduled job completes successfully. Includes job details, execution time, and download link for the report.",
                      vars: "jobName, userName, status, completedAt, duration, rowCount, resultUrl",
                    },
                    {
                      icon: <XCircle className="h-4 w-4 text-destructive" />,
                      title: "Job Failed Notification",
                      badge: "Auto-sent",
                      desc: "Sent when a scheduled job fails. Includes error details and troubleshooting information.",
                      vars: "jobName, userName, failedAt, errorMessage",
                    },
                    {
                      icon: <Mail className="h-4 w-4" />,
                      title: "Test Email",
                      badge: "Manual",
                      desc: "Template for testing email configuration. Confirms SMTP settings are working correctly.",
                      vars: "smtpHost, smtpPort, fromEmail, sentAt",
                    },
                  ].map(({ icon, title, badge, desc, vars }) => (
                    <div key={title} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {icon}
                        <h3 className="font-medium">{title}</h3>
                        <Badge variant="outline">{badge}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{desc}</p>
                      <div className="text-tremor-label text-tremor-content">
                        <strong>Variables:</strong> {vars}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle>Send Test Email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-tremor-default text-tremor-content">
                Send a test email to verify your SMTP configuration is working correctly.
              </p>
              <div className="space-y-2">
                <Label htmlFor="testEmail">Recipient Email</Label>
                <Input
                  id="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your-email@example.com"
                />
              </div>
              <Button
                onClick={() => testMutation.mutate()}
                disabled={!testEmail || testMutation.isPending}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {testMutation.isPending ? "Sending..." : "Send Test Email"}
              </Button>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">💡 Tips</h4>
                <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                  <li>Send to your own email first to test configuration</li>
                  <li>Check spam folder if email doesn&apos;t arrive</li>
                  <li>Gmail users: Use App Password, not your regular password</li>
                  <li>Outlook/Office365: Use SMTP with authentication</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
