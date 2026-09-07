import type { DomainAnalysis } from "../types";
import { analyzeDomainWithOpenAI, generateMermaidWithValidation } from "./openai-fallback";

// Export OpenAI functions for direct use
export { analyzeDomainWithOpenAI, generateMermaidWithValidation };

export interface ConverterInput {
  description: string;
  options?: {
    skipApprovals?: boolean;
    autoGenerateMermaid?: boolean;
  };
}

export interface ConverterOutput {
  success: boolean;
  domainAnalysis: DomainAnalysis;
  mermaidSyntax?: string;
  error?: string;
}

export class AIToMermaidConverter {
  async convert(input: ConverterInput): Promise<ConverterOutput> {
    try {
      // Use OpenAI integration with validation and retry logic
      const domainAnalysis = await analyzeDomainWithOpenAI(input.description);

      // Ensure we have valid domain analysis
      if (!domainAnalysis) {
        return {
          success: false,
          domainAnalysis: { entities: [], relationships: [], summary: "" },
          error: "Domain analysis returned empty result",
        };
      }

      // Generate Mermaid with validation if requested
      let mermaidSyntax: string | undefined;
      if (
        input.options?.autoGenerateMermaid &&
        domainAnalysis.entities &&
        domainAnalysis.relationships
      ) {
        const result = await generateMermaidWithValidation(
          domainAnalysis.entities,
          domainAnalysis.relationships
        );
        mermaidSyntax = result.mermaidSyntax;
      }

      return {
        success: true,
        domainAnalysis,
        mermaidSyntax,
      };
    } catch (error) {
      return {
        success: false,
        domainAnalysis: { entities: [], relationships: [], summary: "" },
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async convertFast(description: string): Promise<string> {
    const result = await this.convert({
      description,
      options: { skipApprovals: true, autoGenerateMermaid: true },
    });

    return result.mermaidSyntax || "";
  }

  async analyzeOnly(description: string): Promise<DomainAnalysis> {
    const result = await this.convert({ description });
    return result.domainAnalysis;
  }
}

// Convenience functions
export async function convertToMermaid(description: string): Promise<string> {
  const converter = new AIToMermaidConverter();
  return converter.convertFast(description);
}

export async function convertToMermaidFast(description: string): Promise<string> {
  const converter = new AIToMermaidConverter();
  return converter.convertFast(description);
}

export async function analyzeDomainOnly(description: string): Promise<DomainAnalysis> {
  const converter = new AIToMermaidConverter();
  return converter.analyzeOnly(description);
}
