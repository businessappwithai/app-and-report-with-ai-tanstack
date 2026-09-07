import { Mastra } from "@mastra/core";
import { domainAgent, entityAgent, mermaidAgent, relationshipAgent } from "./agents";
import { erdDesignWorkflow } from "./workflows";

// Initialize Mastra instance ⭐
export const mastra = new Mastra({
  agents: {
    domainAgent,
    entityAgent,
    relationshipAgent,
    mermaidAgent,
  },
  workflows: {
    erdDesignWorkflow,
  },
});

// Export for external use
export { domainAgent, entityAgent, erdDesignWorkflow, mermaidAgent, relationshipAgent };
