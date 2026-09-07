"use client";

import { useState } from "react";
import { useHumanInTheLoop } from "@/hooks/useHumanInTheLoop";

interface EntityApprovalCardProps {
  entity: {
    name: string;
    description: string;
    confidence: number;
    suggestedAttributes: Array<{
      name: string;
      type: string;
      required: boolean;
    }>;
  };
  entityIndex: number;
  totalEntities: number;
  progress: number;
}

export function EntityApprovalCard() {
  const { data, approve, reject } = useHumanInTheLoop({
    action: "approve_entity",
  });

  const [editing, setEditing] = useState(false);

  if (!data) {
    return <div>Loading...</div>;
  }

  const { entity, entityIndex, totalEntities, progress } = data as EntityApprovalCardProps;

  return (
    <div className="border rounded-lg p-6 max-w-2xl mx-auto">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold">{entity.name}</h2>
          <span className="text-sm text-gray-500">
            Entity {entityIndex + 1} of {totalEntities}
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="text-gray-600 mb-4">{entity.description}</p>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold">Confidence:</span>
          <span
            className={`px-2 py-1 rounded ${
              entity.confidence > 0.8
                ? "bg-green-100 text-green-800"
                : entity.confidence > 0.6
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
            }`}
          >
            {(entity.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="font-semibold mb-2">Attributes:</h3>
        <div className="space-y-2">
          {entity.suggestedAttributes.map((attr, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <code className="bg-gray-100 px-2 py-1 rounded">
                {attr.name}: {attr.type}
              </code>
              {attr.required && <span className="text-xs text-red-600">required</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => approve({ approved: true })}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          ✓ Approve
        </button>

        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          ✎ Modify
        </button>

        <button
          type="button"
          onClick={() => reject({ approved: false })}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          ✗ Reject
        </button>

        <button
          type="button"
          onClick={() => approve({ approved: true, skipRemaining: true })}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 ml-auto"
        >
          Approve All Remaining
        </button>
      </div>

      {editing && (
        <div className="mt-4 p-4 border-t">
          <p className="text-sm text-gray-600">
            Edit entity properties and click Approve to save changes.
          </p>
        </div>
      )}
    </div>
  );
}
