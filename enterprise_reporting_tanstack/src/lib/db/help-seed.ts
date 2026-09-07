import type { Kysely } from "kysely";
import type { Database } from "./kysely-db";

export interface HelpArticle {
  id: string;
  category: string;
  icon: string;
  color: string;
  title: string;
  summary: string;
  content: string;
  keywords: string;
  sort_order: number;
  is_published: number;
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "getting-started",
    category: "getting-started",
    icon: "Rocket",
    color: "blue",
    title: "Getting Started",
    summary: "Welcome to the Enterprise Reporting System. Learn the basics to get started.",
    sort_order: 1,
    is_published: 1,
    keywords: "help introduction tutorial onboarding start",
    content: `
<h2>Welcome to Enterprise Reporting System</h2>
<p>The Enterprise Reporting System is a powerful platform for creating, managing, and sharing business intelligence reports and dashboards.</p>

<div class="callout-blue">
<strong>💡 Tip:</strong> Use the sidebar on the left to navigate between different features. You can collapse it by clicking the chevron icon.
</div>

<h3>Key Features</h3>
<ul>
  <li><strong>Reports</strong> — Create and manage business reports with SQL queries</li>
  <li><strong>Charts</strong> — Visualize your data with interactive charts</li>
  <li><strong>Dashboards</strong> — Build custom dashboards by combining widgets</li>
  <li><strong>SQL Editor</strong> — Write and test SQL queries with Monaco Editor</li>
  <li><strong>Data Sources</strong> — Connect to databases and manage connections</li>
  <li><strong>Scheduling</strong> — Schedule report generation and email delivery</li>
</ul>

<h3>First Steps</h3>
<ol>
  <li>Set up a <strong>Data Source</strong> to connect to your database</li>
  <li>Use the <strong>SQL Editor</strong> to test your queries</li>
  <li>Create your first <strong>Report</strong> using your data</li>
  <li>Build a <strong>Dashboard</strong> to monitor key metrics</li>
</ol>

<div class="callout-green">
<strong>✨ Pro Tip:</strong> Check out the <strong>Keyboard Shortcuts</strong> article to learn keyboard shortcuts that will speed up your workflow.
</div>
    `,
  },

  {
    id: "dashboard-overview",
    category: "dashboard",
    icon: "LayoutDashboard",
    color: "blue",
    title: "Using the Dashboard",
    summary: "Learn how to view and interact with the main dashboard.",
    sort_order: 2,
    is_published: 1,
    keywords: "dashboard overview metrics widgets cards view",
    content: `
<h2>Dashboard Overview</h2>
<p>The dashboard is your command center for viewing key metrics and performance indicators at a glance.</p>

<h3>Main Dashboard Components</h3>
<ul>
  <li><strong>Metric Cards</strong> — Quick summary of total reports, charts, dashboards, and jobs</li>
  <li><strong>Quick Actions</strong> — Shortcuts to create new reports, charts, and dashboards</li>
  <li><strong>Recent Activity</strong> — Track recent job executions and system changes</li>
</ul>

<h3>Widget Cards</h3>
<p>The four main cards show:</p>
<ul>
  <li><strong>Total Reports</strong> — Number of reports created in the system</li>
  <li><strong>Active Charts</strong> — Count of interactive charts</li>
  <li><strong>Dashboards</strong> — Number of dashboards available</li>
  <li><strong>Scheduled Jobs</strong> — Count of automation jobs</li>
</ul>

<div class="callout-blue">
<strong>💡 Tip:</strong> Click on any metric card to view detailed information about that resource type.
</div>

<h3>Quick Actions</h3>
<p>Use the <strong>Quick Actions</strong> section to quickly jump to creating new resources:</p>
<ul>
  <li><strong>SQL Editor</strong> — Start writing queries immediately</li>
  <li><strong>Reports</strong> — Create a new report from scratch</li>
  <li><strong>Charts</strong> — Create a new visualization</li>
  <li><strong>Dashboards</strong> — Build a new custom dashboard</li>
</ul>
    `,
  },

  {
    id: "sql-editor",
    category: "sql-editor",
    icon: "Terminal",
    color: "violet",
    title: "SQL Editor",
    summary: "Write, test, and save SQL queries with the built-in Monaco Editor.",
    sort_order: 3,
    is_published: 1,
    keywords: "sql editor terminal queries syntax highlight monaco autocomplete",
    content: `
<h2>SQL Editor</h2>
<p>The SQL Editor is a powerful tool for writing and testing SQL queries. It includes Monaco Editor with syntax highlighting, autocomplete, and schema information.</p>

<h3>Features</h3>
<ul>
  <li><strong>Syntax Highlighting</strong> — Color-coded SQL syntax for easy reading</li>
  <li><strong>Autocomplete</strong> — Press Ctrl+Space to see available tables and columns</li>
  <li><strong>Schema Browser</strong> — Inspect database tables and fields</li>
  <li><strong>Query Execution</strong> — Run queries and view results instantly</li>
  <li><strong>Save Queries</strong> — Store queries for later use</li>
</ul>

<div class="callout-blue">
<strong>💡 Tip:</strong> Use <strong>Ctrl+Shift+F</strong> to format your SQL query automatically.
</div>

<h3>Running Queries</h3>
<ol>
  <li>Select your <strong>Data Source</strong> from the dropdown</li>
  <li>Write your SQL query in the editor</li>
  <li>Click <strong>Execute</strong> or press <strong>Ctrl+Enter</strong></li>
  <li>View results in the table below</li>
</ol>

<h3>Saving Queries</h3>
<p>Save frequently-used queries for quick access:</p>
<ol>
  <li>Write and test your query</li>
  <li>Click <strong>Save Query</strong></li>
  <li>Enter a name and description</li>
  <li>Access saved queries from the <strong>Saved Queries</strong> menu</li>
</ol>

<div class="callout-orange">
<strong>⚠️ Warning:</strong> Be careful with DELETE and UPDATE statements. Always test with SELECT first to preview the data you'll be modifying.
</div>

<h3>Keyboard Shortcuts</h3>
<ul>
  <li><strong>Ctrl+Enter</strong> — Execute query</li>
  <li><strong>Ctrl+Shift+F</strong> — Format SQL</li>
  <li><strong>Ctrl+Space</strong> — Show autocomplete</li>
  <li><strong>Ctrl+/</strong> — Toggle comment</li>
</ul>
    `,
  },

  {
    id: "reports",
    category: "reports",
    icon: "FileText",
    color: "green",
    title: "Reports",
    summary: "Create and manage business reports with SQL queries and filtering.",
    sort_order: 4,
    is_published: 1,
    keywords: "reports create manage query filter export schedule",
    content: `
<h2>Reports</h2>
<p>Reports allow you to create structured business intelligence documents that combine SQL queries with formatting, filtering, and sharing capabilities.</p>

<h3>Creating a Report</h3>
<ol>
  <li>Navigate to <strong>Reports</strong> in the sidebar</li>
  <li>Click <strong>Create Report</strong></li>
  <li>Select a <strong>Data Source</strong></li>
  <li>Write your <strong>SQL Query</strong></li>
  <li>Configure <strong>Display Settings</strong> (title, description, etc.)</li>
  <li>Add <strong>Filters</strong> for user customization</li>
  <li>Click <strong>Save</strong></li>
</ol>

<div class="callout-blue">
<strong>💡 Tip:</strong> Use parameterized queries with <strong>[[parameter_name]]</strong> syntax to create dynamic filters for users.
</div>

<h3>Report Filters</h3>
<p>Add filters to allow users to customize report data:</p>
<ul>
  <li><strong>Date Range</strong> — Filter by start and end dates</li>
  <li><strong>Single Select</strong> — Choose one value from a dropdown</li>
  <li><strong>Multi-Select</strong> — Choose multiple values</li>
  <li><strong>Text Input</strong> — Enter custom text values</li>
</ul>

<h3>Sharing Reports</h3>
<ul>
  <li><strong>Internal</strong> — Share with specific users or roles</li>
  <li><strong>Public Link</strong> — Generate a sharable public URL</li>
  <li><strong>Email</strong> — Send report to email recipients</li>
</ul>

<h3>Exporting Data</h3>
<p>Export report data in multiple formats:</p>
<ul>
  <li><strong>CSV</strong> — For spreadsheet applications</li>
  <li><strong>Excel</strong> — Formatted for Microsoft Excel</li>
  <li><strong>PDF</strong> — Generate printable PDF documents</li>
</ul>

<div class="callout-green">
<strong>✨ Pro Tip:</strong> Use the <strong>Report Generator</strong> feature to automatically generate reports using AI.
</div>
    `,
  },

  {
    id: "charts",
    category: "charts",
    icon: "BarChart3",
    color: "orange",
    title: "Charts",
    summary: "Create interactive data visualizations with multiple chart types.",
    sort_order: 5,
    is_published: 1,
    keywords: "charts visualization graphs bar line pie area column",
    content: `
<h2>Charts</h2>
<p>Charts transform your data into visual representations. The system supports multiple chart types including bar, line, pie, and area charts.</p>

<h3>Supported Chart Types</h3>
<ul>
  <li><strong>Bar Chart</strong> — Compare values across categories</li>
  <li><strong>Line Chart</strong> — Show trends over time</li>
  <li><strong>Pie Chart</strong> — Display parts of a whole</li>
  <li><strong>Area Chart</strong> — Show cumulative trends</li>
  <li><strong>Column Chart</strong> — Vertical bar comparisons</li>
</ul>

<h3>Creating a Chart</h3>
<ol>
  <li>Go to <strong>Charts</strong> in the sidebar</li>
  <li>Click <strong>Create Chart</strong></li>
  <li>Select your <strong>Data Source</strong> and write a <strong>Query</strong></li>
  <li>Choose a <strong>Chart Type</strong></li>
  <li>Configure <strong>X-Axis</strong> and <strong>Y-Axis</strong> fields</li>
  <li>Customize colors and styling</li>
  <li>Click <strong>Save</strong></li>
</ol>

<div class="callout-blue">
<strong>💡 Tip:</strong> Your query must return at least two columns — one for categories and one for values.
</div>

<h3>Customization Options</h3>
<ul>
  <li><strong>Colors</strong> — Choose custom color schemes</li>
  <li><strong>Title</strong> — Add a descriptive title</li>
  <li><strong>Legend</strong> — Show or hide the legend</li>
  <li><strong>Grid</strong> — Display grid lines</li>
  <li><strong>Tooltips</strong> — Show data values on hover</li>
</ul>

<h3>Using Charts in Dashboards</h3>
<p>Charts can be added to dashboards as widgets:</p>
<ol>
  <li>Create or edit a dashboard</li>
  <li>Click <strong>Add Widget</strong></li>
  <li>Select <strong>Chart</strong> and choose your chart</li>
  <li>Resize and position as needed</li>
</ol>

<div class="callout-orange">
<strong>⚠️ Note:</strong> Large datasets (100K+ rows) may take longer to render. Consider adding WHERE clauses to limit results.
</div>
    `,
  },

  {
    id: "dashboards",
    category: "dashboards",
    icon: "LayoutGrid",
    color: "cyan",
    title: "Dashboards",
    summary: "Build custom dashboards by combining reports and charts.",
    sort_order: 6,
    is_published: 1,
    keywords: "dashboard build widgets customize layout responsive",
    content: `
<h2>Dashboards</h2>
<p>Dashboards provide a unified view of your business metrics and KPIs. Combine multiple reports and charts into a single customizable interface.</p>

<h3>Creating a Dashboard</h3>
<ol>
  <li>Navigate to <strong>Dashboards</strong> in the sidebar</li>
  <li>Click <strong>Create Dashboard</strong></li>
  <li>Enter a <strong>Title</strong> and <strong>Description</strong></li>
  <li>Click <strong>Save</strong> to create the dashboard</li>
  <li>Click <strong>Edit</strong> to add widgets</li>
</ol>

<div class="callout-blue">
<strong>💡 Tip:</strong> Dashboard layouts are responsive and automatically adjust on mobile devices.
</div>

<h3>Adding Widgets</h3>
<p>Add content to your dashboard:</p>
<ol>
  <li>In edit mode, click <strong>Add Widget</strong></li>
  <li>Choose widget type: <strong>Chart</strong>, <strong>Report</strong>, or <strong>Text</strong></li>
  <li>Select the content you want to add</li>
  <li>Drag to resize and position</li>
  <li>Click <strong>Save Dashboard</strong></li>
</ol>

<h3>Widget Types</h3>
<ul>
  <li><strong>Chart Widget</strong> — Display interactive charts</li>
  <li><strong>Report Widget</strong> — Show report data in table format</li>
  <li><strong>Text Widget</strong> — Add markdown formatted text and notes</li>
</ul>

<h3>Dashboard Customization</h3>
<ul>
  <li><strong>Refresh Rate</strong> — Set auto-refresh interval (5 min, 15 min, 1 hour, etc.)</li>
  <li><strong>Theme</strong> — Choose light or dark theme</li>
  <li><strong>Share</strong> — Share dashboard with users or create public link</li>
  <li><strong>Export</strong> — Save as PDF or image</li>
</ul>

<h3>Real-time Updates</h3>
<p>Dashboards can be configured to refresh automatically:</p>
<ul>
  <li>Click <strong>Settings</strong></li>
  <li>Set <strong>Refresh Interval</strong></li>
  <li>Widgets will auto-update at the specified interval</li>
</ul>

<div class="callout-green">
<strong>✨ Pro Tip:</strong> Use filters on dashboard widgets to allow users to drill down into specific data ranges.
</div>
    `,
  },

  {
    id: "filters",
    category: "filters",
    icon: "Filter",
    color: "yellow",
    title: "Filters",
    summary: "Create and manage filter sets for reports and charts.",
    sort_order: 7,
    is_published: 1,
    keywords: "filters criteria where clause parameterized dynamic",
    content: `
<h2>Filters</h2>
<p>Filters allow you and your users to customize the data displayed in reports and charts without changing the underlying queries.</p>

<h3>Filter Types</h3>
<ul>
  <li><strong>Date Range</strong> — Select start and end dates</li>
  <li><strong>Single Select</strong> — Choose one option from a dropdown</li>
  <li><strong>Multi-Select</strong> — Select multiple values</li>
  <li><strong>Text Input</strong> — Enter custom text or numbers</li>
  <li><strong>Checkbox</strong> — Boolean true/false selection</li>
</ul>

<h3>Creating Filters in Reports</h3>
<ol>
  <li>Create or edit a report</li>
  <li>Click <strong>Add Filter</strong></li>
  <li>Choose filter type and field name</li>
  <li>Set default value (optional)</li>
  <li>Click <strong>Save</strong></li>
</ol>

<div class="callout-blue">
<strong>💡 Tip:</strong> Use parameterized queries with <strong>[[column_name]]</strong> syntax. The system automatically maps filter values to parameters.
</div>

<h3>Filter Example</h3>
<p><strong>Query:</strong></p>
<div class="callout-blue">
SELECT * FROM sales WHERE date >= [[start_date]] AND date <= [[end_date]] AND region = [[region]]
</div>

<p><strong>Filters to create:</strong></p>
<ul>
  <li>Filter: start_date (Type: Date)</li>
  <li>Filter: end_date (Type: Date)</li>
  <li>Filter: region (Type: Single Select with options: North, South, East, West)</li>
</ul>

<h3>Filter Best Practices</h3>
<ul>
  <li><strong>Be Specific</strong> — Create filters for the most commonly needed values</li>
  <li><strong>Set Defaults</strong> — Provide sensible default values to reduce confusion</li>
  <li><strong>Clear Labels</strong> — Use descriptive labels for filter fields</li>
  <li><strong>Limit Options</strong> — Pre-define options for dropdowns instead of free text</li>
</ul>

<div class="callout-orange">
<strong>⚠️ Performance:</strong> Complex filters on large datasets may impact performance. Test with your data before deploying.
</div>
    `,
  },

  {
    id: "jobs",
    category: "jobs",
    icon: "Play",
    color: "emerald",
    title: "Scheduled Jobs",
    summary: "Automate report generation and email delivery with scheduled jobs.",
    sort_order: 8,
    is_published: 1,
    keywords: "jobs scheduling cron automation execution monitor",
    content: `
<h2>Scheduled Jobs</h2>
<p>Schedule reports to run automatically at specified intervals and email results to recipients.</p>

<h3>Creating a Scheduled Job</h3>
<ol>
  <li>Navigate to <strong>Jobs</strong> in the sidebar</li>
  <li>Click <strong>Create Job</strong></li>
  <li>Select a <strong>Report</strong> to schedule</li>
  <li>Set <strong>Schedule</strong> (frequency and time)</li>
  <li>Configure <strong>Email Recipients</strong> (optional)</li>
  <li>Click <strong>Save</strong></li>
</ol>

<div class="callout-blue">
<strong>💡 Tip:</strong> Jobs run in your configured timezone. Check <strong>Settings</strong> to verify the correct timezone.
</div>

<h3>Schedule Frequency Options</h3>
<ul>
  <li><strong>Every Day</strong> — Run daily at specified time</li>
  <li><strong>Every Week</strong> — Run on selected day of week</li>
  <li><strong>Every Month</strong> — Run on specified date</li>
  <li><strong>Custom Cron</strong> — Use cron expression for complex schedules</li>
</ul>

<h3>Email Configuration</h3>
<p>Automatically send report results via email:</p>
<ul>
  <li><strong>Recipients</strong> — Add email addresses to receive reports</li>
  <li><strong>Format</strong> — Choose CSV, Excel, or PDF</li>
  <li><strong>Subject</strong> — Customize email subject line</li>
  <li><strong>Include Chart</strong> — Attach chart images to email</li>
</ul>

<h3>Monitoring Execution</h3>
<p>Track job execution status:</p>
<ol>
  <li>Go to <strong>Jobs</strong> → <strong>Executions</strong></li>
  <li>View status of recent job runs</li>
  <li>Check logs for any errors</li>
  <li>Verify email delivery status</li>
</ol>

<div class="callout-green">
<strong>✨ Pro Tip:</strong> Set up multiple jobs with different schedules to report on different time periods (daily, weekly, monthly).
</div>

<h3>Troubleshooting</h3>
<ul>
  <li><strong>Job Not Running?</strong> — Check that the schedule is enabled and system time is correct</li>
  <li><strong>Email Not Received?</strong> — Verify email configuration in Settings</li>
  <li><strong>Data Missing?</strong> — Check data source connectivity and query results</li>
</ul>
    `,
  },

  {
    id: "monitoring",
    category: "monitoring",
    icon: "Activity",
    color: "red",
    title: "Monitoring & Alerts",
    summary: "Set up monitoring rules and alerts for critical metrics.",
    sort_order: 9,
    is_published: 1,
    keywords: "monitoring alerts rules threshold notifications email",
    content: `
<h2>Monitoring & Alerts</h2>
<p>Create monitoring rules to track important metrics and receive alerts when values exceed specified thresholds.</p>

<h3>Creating a Monitoring Rule</h3>
<ol>
  <li>Navigate to <strong>Monitoring</strong> in the sidebar</li>
  <li>Click <strong>Create Rule</strong></li>
  <li>Select a <strong>Report</strong> to monitor</li>
  <li>Set <strong>Condition</strong> (e.g., value > 1000)</li>
  <li>Set <strong>Check Frequency</strong> (e.g., every 5 minutes)</li>
  <li>Configure <strong>Notifications</strong> (email, etc.)</li>
  <li>Click <strong>Save</strong></li>
</ol>

<div class="callout-blue">
<strong>💡 Tip:</strong> Use monitoring for critical business metrics like sales targets, system performance, or error rates.
</div>

<h3>Condition Types</h3>
<ul>
  <li><strong>Greater Than (>)</strong> — Alert when value exceeds threshold</li>
  <li><strong>Less Than (<)</strong> — Alert when value falls below threshold</li>
  <li><strong>Equal To (=)</strong> — Alert when value matches</li>
  <li><strong>Not Equal (!)</strong> — Alert when value doesn't match</li>
</ul>

<h3>Notification Options</h3>
<ul>
  <li><strong>Email</strong> — Send alert to email recipients</li>
  <li><strong>In-App</strong> — Display notification in application</li>
  <li><strong>Webhook</strong> — Send alert to external system</li>
</ul>

<h3>Alert History</h3>
<p>Review past alerts:</p>
<ol>
  <li>Go to <strong>Monitoring</strong> → <strong>Alert History</strong></li>
  <li>View all triggered alerts</li>
  <li>See time, value, and condition that triggered alert</li>
  <li>Mark alerts as acknowledged</li>
</ol>

<div class="callout-orange">
<strong>⚠️ Alert Fatigue:</strong> Set thresholds carefully to avoid too many false alerts. Consider using rolling averages instead of single data points.
</div>

<div class="callout-green">
<strong>✨ Pro Tip:</strong> Combine multiple conditions to create more sophisticated rules (e.g., alert only if value exceeds threshold AND today is a weekday).
</div>
    `,
  },

  {
    id: "nl-query",
    category: "nl-query",
    icon: "MessageSquare",
    color: "purple",
    title: "NL Query (Natural Language)",
    summary: "Query your data using natural language instead of SQL.",
    sort_order: 10,
    is_published: 1,
    keywords: "natural language nlquery ai machine learning text",
    content: `
<h2>Natural Language Query (NL Query)</h2>
<p>Ask questions about your data in plain English instead of writing SQL queries. The AI translates your questions to SQL automatically.</p>

<h3>How It Works</h3>
<ol>
  <li>Select a <strong>Data Source</strong></li>
  <li>Type your question in plain English (e.g., "What are total sales by region?")</li>
  <li>The AI translates your question to SQL</li>
  <li>Results are displayed instantly</li>
  <li>Refine your question or view the generated SQL</li>
</ol>

<div class="callout-blue">
<strong>💡 Tip:</strong> The more specific your question, the better the results. Include field names and operators when possible.
</div>

<h3>Example Queries</h3>
<ul>
  <li>"Show me sales by month for the last year"</li>
  <li>"What are the top 10 products by revenue?"</li>
  <li>"How many customers purchased each region?"</li>
  <li>"Compare Q1 and Q2 revenue"</li>
</ul>

<h3>Viewing Generated SQL</h3>
<p>Review the SQL that was generated:</p>
<ol>
  <li>Click <strong>View SQL</strong> after getting results</li>
  <li>See the generated query</li>
  <li>Edit the query directly if needed</li>
  <li>Re-run with modifications</li>
</ol>

<h3>Saving NL Queries</h3>
<p>Save your NL queries for future use:</p>
<ol>
  <li>Type your natural language question</li>
  <li>Get results</li>
  <li>Click <strong>Save Query</strong></li>
  <li>Access saved queries from the menu</li>
</ol>

<div class="callout-orange">
<strong>⚠️ Note:</strong> The AI may not understand complex business logic or custom calculations. For complex queries, use the SQL Editor directly.
</div>

<div class="callout-green">
<strong>✨ Pro Tip:</strong> Use NL Query to quickly prototype reports before writing complex SQL queries.
</div>
    `,
  },

  {
    id: "report-generator",
    category: "report-generator",
    icon: "Wand2",
    color: "pink",
    title: "AI Report Generator",
    summary: "Automatically generate professional reports using AI.",
    sort_order: 11,
    is_published: 1,
    keywords: "ai report generation automatic template professional",
    content: `
<h2>AI Report Generator</h2>
<p>Use AI to automatically generate professional reports from your data. Select fields and let the system create formatted reports.</p>

<h3>Generating a Report</h3>
<ol>
  <li>Navigate to <strong>Report Generator</strong></li>
  <li>Select a <strong>Data Source</strong></li>
  <li>Choose <strong>Report Type</strong> (Summary, Detailed, Executive, etc.)</li>
  <li>Select <strong>Metrics</strong> to include</li>
  <li>Add optional <strong>Analysis</strong> (insights, trends, recommendations)</li>
  <li>Click <strong>Generate</strong></li>
</ol>

<div class="callout-blue">
<strong>💡 Tip:</strong> The AI analyzes your data and generates meaningful insights automatically.
</div>

<h3>Report Sections</h3>
<p>Generated reports typically include:</p>
<ul>
  <li><strong>Executive Summary</strong> — High-level overview of findings</li>
  <li><strong>Key Metrics</strong> — Important numbers and trends</li>
  <li><strong>Analysis</strong> — AI-generated insights and observations</li>
  <li><strong>Charts</strong> — Visualizations of key data</li>
  <li><strong>Recommendations</strong> — Suggested actions based on data</li>
</ul>

<h3>Customization Options</h3>
<ul>
  <li><strong>Report Style</strong> — Choose professional template</li>
  <li><strong>Color Scheme</strong> — Match your brand colors</li>
  <li><strong>Logo</strong> — Add company logo</li>
  <li><strong>Footer</strong> — Add disclaimer or footer text</li>
</ul>

<h3>Exporting Generated Reports</h3>
<p>Save your generated reports in multiple formats:</p>
<ul>
  <li><strong>PDF</strong> — Professional document format</li>
  <li><strong>Word</strong> — Editable Word document</li>
  <li><strong>HTML</strong> — Web-ready format</li>
</ul>

<div class="callout-green">
<strong>✨ Pro Tip:</strong> Schedule AI reports to be generated and emailed automatically on a daily, weekly, or monthly basis.
</div>

<h3>AI Analysis Insights</h3>
<p>The AI provides insights such as:</p>
<ul>
  <li><strong>Trends</strong> — Identifies upward/downward movements</li>
  <li><strong>Anomalies</strong> — Flags unusual values or patterns</li>
  <li><strong>Comparisons</strong> — Compares periods or segments</li>
  <li><strong>Predictions</strong> — Forecasts future values</li>
</ul>
    `,
  },

  {
    id: "data-sources",
    category: "data-sources",
    icon: "Database",
    color: "teal",
    title: "Data Sources",
    summary: "Connect to databases and manage data source connections.",
    sort_order: 12,
    is_published: 1,
    keywords: "database connection datasource mysql postgres test inspect",
    content: `
<h2>Data Sources</h2>
<p>Data Sources are connections to databases that provide the data for your reports, charts, and queries.</p>

<h3>Supported Database Types</h3>
<ul>
  <li><strong>MySQL</strong> — Popular open-source database</li>
  <li><strong>MariaDB</strong> — MySQL-compatible database</li>
  <li><strong>PostgreSQL</strong> — Advanced open-source database</li>
  <li><strong>SQL Server</strong> — Microsoft enterprise database</li>
</ul>

<h3>Creating a Data Source</h3>
<ol>
  <li>Go to <strong>Data Sources</strong> in the sidebar</li>
  <li>Click <strong>Create Data Source</strong></li>
  <li>Select <strong>Database Type</strong></li>
  <li>Enter <strong>Connection Details</strong>:
    <ul>
      <li>Host/Server address</li>
      <li>Port number</li>
      <li>Database name</li>
      <li>Username</li>
      <li>Password</li>
    </ul>
  </li>
  <li>Click <strong>Test Connection</strong> to verify</li>
  <li>Click <strong>Save</strong></li>
</ol>

<div class="callout-blue">
<strong>💡 Tip:</strong> Always test your connection before saving to catch configuration errors early.
</div>

<h3>Schema Inspection</h3>
<p>View database structure:</p>
<ol>
  <li>Select a data source</li>
  <li>Click <strong>Inspect Schema</strong></li>
  <li>Browse tables, columns, and field types</li>
  <li>View sample data</li>
</ol>

<h3>Connection Security</h3>
<ul>
  <li><strong>SSL/TLS</strong> — Encrypt connection (optional)</li>
  <li><strong>SSH Tunnel</strong> — Connect through SSH proxy</li>
  <li><strong>IP Whitelist</strong> — Restrict by IP address</li>
  <li><strong>Read-Only User</strong> — Use restricted database user</li>
</ul>

<div class="callout-orange">
<strong>⚠️ Security:</strong> Always use strong passwords and read-only database users. Never commit credentials to version control.
</div>

<h3>Troubleshooting Connection Issues</h3>
<ul>
  <li><strong>Connection Timeout</strong> — Check host address and network connectivity</li>
  <li><strong>Authentication Failed</strong> — Verify username and password</li>
  <li><strong>Database Not Found</strong> — Confirm database name</li>
  <li><strong>Permission Denied</strong> — Ensure user has correct permissions</li>
</ul>

<div class="callout-green">
<strong>✨ Pro Tip:</strong> Test your SQL queries in the source database first before creating reports to ensure optimal performance.
</div>
    `,
  },

  {
    id: "queue",
    category: "queue",
    icon: "ListOrdered",
    color: "gray",
    title: "Queue Management",
    summary: "Monitor and manage the job execution queue.",
    sort_order: 13,
    is_published: 1,
    keywords: "queue jobs pending processing worker background async",
    content: `
<h2>Queue Management</h2>
<p>The job queue manages background tasks like report generation, exports, and scheduled jobs.</p>

<h3>Queue Dashboard</h3>
<p>View queue status:</p>
<ul>
  <li><strong>Pending</strong> — Jobs waiting to run</li>
  <li><strong>Processing</strong> — Currently running jobs</li>
  <li><strong>Completed</strong> — Successfully finished jobs</li>
  <li><strong>Failed</strong> — Jobs with errors</li>
</ul>

<div class="callout-blue">
<strong>💡 Tip:</strong> The queue prioritizes urgent tasks. Manually generated reports run immediately, while scheduled tasks run at their scheduled time.
</div>

<h3>Queue Monitoring</h3>
<ol>
  <li>Navigate to <strong>Queue Management</strong></li>
  <li>View current queue status</li>
  <li>Check job progress and estimated completion time</li>
  <li>View historical execution logs</li>
</ol>

<h3>Job Actions</h3>
<ul>
  <li><strong>Retry Failed</strong> — Re-run a failed job</li>
  <li><strong>Cancel Pending</strong> — Stop a pending job</li>
  <li><strong>View Logs</strong> — See job execution details</li>
  <li><strong>Download Results</strong> — Get job output</li>
</ul>

<h3>Performance Optimization</h3>
<ul>
  <li><strong>Schedule Off-Peak</strong> — Run large reports during low-usage hours</li>
  <li><strong>Batch Jobs</strong> — Group similar jobs together</li>
  <li><strong>Monitor Queue Size</strong> — Check for bottlenecks</li>
</ul>

<div class="callout-orange">
<strong>⚠️ Note:</strong> Large exports or complex reports may take several minutes. Monitor the queue for long-running jobs.
</div>

<div class="callout-green">
<strong>✨ Pro Tip:</strong> Set up email notifications for job completion so you know when results are ready.
</div>
    `,
  },

  {
    id: "logs",
    category: "logs",
    icon: "ScrollText",
    color: "slate",
    title: "System Logs",
    summary: "View system logs and track application events.",
    sort_order: 14,
    is_published: 1,
    keywords: "logs system events audit trail search filter debug",
    content: `
<h2>System Logs</h2>
<p>System logs record all application events and activities for debugging, auditing, and compliance purposes.</p>

<h3>Log Types</h3>
<ul>
  <li><strong>Info</strong> — Informational messages (blue)</li>
  <li><strong>Warning</strong> — Warning messages (yellow)</li>
  <li><strong>Error</strong> — Error messages (red)</li>
  <li><strong>Debug</strong> — Debug information (gray)</li>
</ul>

<h3>Accessing Logs</h3>
<ol>
  <li>Navigate to <strong>System Logs</strong> in the sidebar</li>
  <li>View recent log entries (newest first)</li>
  <li>Filter by log level, date range, or keyword</li>
  <li>Click on entry for full details</li>
</ol>

<div class="callout-blue">
<strong>💡 Tip:</strong> Use the search feature to find logs related to specific events or components.
</div>

<h3>Log Details</h3>
<p>Each log entry includes:</p>
<ul>
  <li><strong>Timestamp</strong> — When the event occurred</li>
  <li><strong>Level</strong> — Severity level (Info, Warning, Error)</li>
  <li><strong>Component</strong> — What part of the system generated the log</li>
  <li><strong>Message</strong> — Description of the event</li>
  <li><strong>User</strong> — Who triggered the event (if applicable)</li>
</ul>

<h3>Common Log Scenarios</h3>
<ul>
  <li><strong>Failed Report</strong> — Look for Error logs with "report" keyword</li>
  <li><strong>Data Source Issue</strong> — Search for "connection" or "database"</li>
  <li><strong>Job Failure</strong> — Filter by date and component "job-worker"</li>
  <li><strong>Audit Trail</strong> — View all changes to specific data source</li>
</ul>

<h3>Log Retention</h3>
<p>Logs are retained for:</p>
<ul>
  <li><strong>30 days</strong> — Recent logs</li>
  <li><strong>90 days</strong> — Archive storage</li>
  <li><strong>1 year</strong> — Compliance archive</li>
</ul>

<div class="callout-orange">
<strong>⚠️ Privacy:</strong> Logs may contain sensitive data. Always keep logs secure and restrict access to appropriate users.
</div>

<div class="callout-green">
<strong>✨ Pro Tip:</strong> Set up log alerts for errors so you're notified of system issues immediately.
</div>
    `,
  },

  {
    id: "users-roles",
    category: "users-roles",
    icon: "Users",
    color: "indigo",
    title: "Users & Roles",
    summary: "Manage users, roles, and access permissions.",
    sort_order: 15,
    is_published: 1,
    keywords: "users roles permissions access control rbac admin",
    content: `
<h2>Users & Roles</h2>
<p>Manage application access by creating users and assigning roles with specific permissions.</p>

<h3>User Management</h3>
<p>Creating and managing users:</p>
<ol>
  <li>Go to <strong>Settings</strong> → <strong>Users</strong></li>
  <li>Click <strong>Add User</strong></li>
  <li>Enter email address and full name</li>
  <li>Select role(s)</li>
  <li>Click <strong>Send Invitation</strong></li>
</ol>

<div class="callout-blue">
<strong>💡 Tip:</strong> Users receive email invitations to set up their password and activate their account.
</div>

<h3>Available Roles</h3>
<ul>
  <li><strong>Admin</strong> — Full access to all features and settings</li>
  <li><strong>Editor</strong> — Can create and edit reports, charts, dashboards</li>
  <li><strong>Viewer</strong> — Read-only access to reports and dashboards</li>
  <li><strong>Data Manager</strong> — Can manage data sources and connections</li>
</ul>

<h3>Role Permissions</h3>
<p><strong>Admin:</strong> All permissions</p>
<p><strong>Editor:</strong></p>
<ul>
  <li>Create and edit reports</li>
  <li>Create and edit charts</li>
  <li>Build dashboards</li>
  <li>Schedule jobs</li>
  <li>Cannot manage users or system settings</li>
</ul>

<p><strong>Viewer:</strong></p>
<ul>
  <li>View reports (read-only)</li>
  <li>View dashboards</li>
  <li>Cannot create or modify content</li>
</ul>

<h3>User Deactivation</h3>
<p>Deactivate user accounts:</p>
<ol>
  <li>Go to <strong>Settings</strong> → <strong>Users</strong></li>
  <li>Find the user in the list</li>
  <li>Click <strong>Deactivate</strong></li>
  <li>User will no longer be able to log in</li>
</ol>

<div class="callout-orange">
<strong>⚠️ Important:</strong> Deactivating doesn't delete user data. Reports created by deactivated users remain accessible.
</div>

<h3>Password Reset</h3>
<p>Help users reset forgotten passwords:</p>
<ol>
  <li>Go to <strong>Settings</strong> → <strong>Users</strong></li>
  <li>Click <strong>Reset Password</strong> for the user</li>
  <li>User receives reset email</li>
</ol>

<div class="callout-green">
<strong>✨ Pro Tip:</strong> Use roles to implement least-privilege access — give users only the permissions they need.
</div>
    `,
  },

  {
    id: "settings",
    category: "settings",
    icon: "Settings",
    color: "amber",
    title: "Settings",
    summary: "Configure system settings and preferences.",
    sort_order: 16,
    is_published: 1,
    keywords: "settings configuration preferences email timezone locale",
    content: `
<h2>Settings</h2>
<p>Configure system-wide settings and user preferences.</p>

<h3>General Settings</h3>
<ul>
  <li><strong>Application Name</strong> — Display name for the system</li>
  <li><strong>Logo</strong> — Company logo for header and reports</li>
  <li><strong>Theme</strong> — Light or dark mode default</li>
  <li><strong>Timezone</strong> — Timezone for scheduling and reports</li>
</ul>

<h3>Email Configuration</h3>
<p>Set up email for reports and notifications:</p>
<ol>
  <li>Go to <strong>Settings</strong> → <strong>Email</strong></li>
  <li>Configure SMTP server:</li>
  <li>
    <ul>
      <li>SMTP Host</li>
      <li>SMTP Port</li>
      <li>Username</li>
      <li>Password</li>
      <li>From Address</li>
    </ul>
  </li>
  <li>Click <strong>Test Email</strong> to verify</li>
  <li>Click <strong>Save</strong></li>
</ol>

<div class="callout-blue">
<strong>💡 Tip:</strong> Use a dedicated email account for the system (e.g., noreply@company.com).
</div>

<h3>User Preferences</h3>
<p>Each user can customize their settings:</p>
<ul>
  <li><strong>Language</strong> — Choose preferred language</li>
  <li><strong>Timezone</strong> — Personal timezone for display</li>
  <li><strong>Theme</strong> — Personal light/dark mode preference</li>
  <li><strong>Notifications</strong> — Email notification preferences</li>
</ul>

<h3>API Configuration</h3>
<p>For advanced integrations:</p>
<ol>
  <li>Go to <strong>Settings</strong> → <strong>API Keys</strong></li>
  <li>Click <strong>Generate API Key</strong></li>
  <li>Copy key (shown once only)</li>
  <li>Use for API requests</li>
</ol>

<div class="callout-orange">
<strong>⚠️ Security:</strong> Treat API keys like passwords. Regenerate if compromised.
</div>

<h3>Backup & Export</h3>
<p>Backup your configuration:</p>
<ul>
  <li><strong>Export Settings</strong> — Download configuration as JSON</li>
  <li><strong>Import Settings</strong> — Upload configuration from backup</li>
</ul>

<div class="callout-green">
<strong>✨ Pro Tip:</strong> Regularly backup your settings in case you need to restore or migrate to a new server.
</div>
    `,
  },

  {
    id: "keyboard-shortcuts",
    category: "keyboard-shortcuts",
    icon: "Keyboard",
    color: "blue",
    title: "Keyboard Shortcuts",
    summary: "Learn keyboard shortcuts to speed up your workflow.",
    sort_order: 17,
    is_published: 1,
    keywords: "keyboard shortcuts hotkeys ctrl meta command",
    content: `
<h2>Keyboard Shortcuts</h2>
<p>Master these keyboard shortcuts to work faster in the Enterprise Reporting System.</p>

<h3>Global Shortcuts</h3>
<ul>
  <li><strong>?</strong> — Open help (this dialog)</li>
  <li><strong>Ctrl+K</strong> — Quick command palette</li>
  <li><strong>Escape</strong> — Close dialogs and menus</li>
</ul>

<h3>SQL Editor Shortcuts</h3>
<ul>
  <li><strong>Ctrl+Enter</strong> — Execute query</li>
  <li><strong>Ctrl+Shift+F</strong> — Format SQL</li>
  <li><strong>Ctrl+/</strong> — Toggle comment</li>
  <li><strong>Ctrl+Space</strong> — Show autocomplete</li>
  <li><strong>Ctrl+F</strong> — Find in query</li>
  <li><strong>Ctrl+H</strong> — Find and replace</li>
  <li><strong>Ctrl+S</strong> — Save query</li>
</ul>

<h3>Navigation Shortcuts</h3>
<ul>
  <li><strong>Alt+1</strong> — Go to Dashboard</li>
  <li><strong>Alt+2</strong> — Go to SQL Editor</li>
  <li><strong>Alt+3</strong> — Go to Reports</li>
  <li><strong>Alt+4</strong> — Go to Charts</li>
  <li><strong>Alt+5</strong> — Go to Dashboards</li>
  <li><strong>Alt+6</strong> — Go to Data Sources</li>
</ul>

<h3>Editor Shortcuts (Reports, Charts, Dashboards)</h3>
<ul>
  <li><strong>Ctrl+S</strong> — Save changes</li>
  <li><strong>Ctrl+Z</strong> — Undo</li>
  <li><strong>Ctrl+Y</strong> — Redo</li>
  <li><strong>Delete</strong> — Remove selected item</li>
</ul>

<h3>Dialog Shortcuts</h3>
<ul>
  <li><strong>Enter</strong> — Submit/OK</li>
  <li><strong>Escape</strong> — Cancel/Close</li>
  <li><strong>Tab</strong> — Next field</li>
  <li><strong>Shift+Tab</strong> — Previous field</li>
</ul>

<div class="callout-blue">
<strong>💡 Tip:</strong> macOS users can use <strong>Cmd</strong> instead of <strong>Ctrl</strong> for most shortcuts.
</div>

<h3>Browser Compatibility</h3>
<p>Shortcuts work in:</p>
<ul>
  <li>Chrome / Edge / Brave</li>
  <li>Firefox</li>
  <li>Safari (with some differences)</li>
</ul>

<div class="callout-green">
<strong>✨ Pro Tip:</strong> Memorizing the most-used shortcuts (Ctrl+Enter, Ctrl+S, Ctrl+Shift+F) will significantly speed up your workflow.
</div>
    `,
  },
];

export async function seedHelpArticles(db: Kysely<Database>) {
  for (const article of HELP_ARTICLES) {
    await db
      .insertInto("help_articles")
      .values({
        id: article.id,
        category: article.category,
        icon: article.icon,
        color: article.color,
        title: article.title,
        summary: article.summary,
        content: article.content,
        keywords: article.keywords,
        sort_order: article.sort_order,
        is_published: article.is_published,
      })
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          category: article.category,
          icon: article.icon,
          color: article.color,
          title: article.title,
          summary: article.summary,
          content: article.content,
          keywords: article.keywords,
          sort_order: article.sort_order,
          is_published: article.is_published,
        })
      )
      .execute();
  }
}
