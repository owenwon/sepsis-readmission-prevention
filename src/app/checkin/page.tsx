"use client";

import { useState } from "react";
import { dailyCheckInQuestions } from "@/lib/questions";
import type { Question } from "@/lib/questions/types";

export default function CheckInPage() {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  // Filter questions based on prerequisites (only evaluate 'current' source)
  const visibleQuestions = dailyCheckInQuestions.filter((q) => {
    if (q.prerequisites && q.prerequisites.length > 0) {
      return q.prerequisites.every((prereq) => {
        // Skip onboarding prerequisites — we don't have that data yet
        if (prereq.source === "onboarding") return true;

        const answer = answers[prereq.field];
        if (answer === undefined) return false;

        switch (prereq.operator) {
          case "==":
            return answer === prereq.value;
          case "!=":
            return answer !== prereq.value;
          case ">":
            return answer > prereq.value;
          case "<":
            return answer < prereq.value;
          case ">=":
            return answer >= prereq.value;
          case "<=":
            return answer <= prereq.value;
          case "includes":
            return Array.isArray(answer) && answer.includes(prereq.value);
          case "excludes":
            return Array.isArray(answer) && !answer.includes(prereq.value);
          default:
            return true;
        }
      });
    }
    return true;
  });

  const currentQuestion = visibleQuestions[currentIndex];
  const totalQuestions = visibleQuestions.length;

  const setAnswer = (question: Question, value: any) => {
    setAnswers((prev) => {
      const updated = { ...prev, [question.id]: value };

      if (question.businessLogic?.mapToMultipleFields && question.businessLogic.customMapping) {
        const mapped = question.businessLogic.customMapping(value);
        Object.assign(updated, mapped);
        updated[question.id] = value;
      }

      if (typeof question.schemaField === "string" && question.id !== question.schemaField) {
        updated[question.schemaField] = value;
      }

      return updated;
    });
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setFinished(true);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (finished) {
    return (
      <div>
        <h1>Daily Check-In Complete</h1>
        <p>Here are your answers:</p>
        <ul>
          {Object.entries(answers).map(([key, value]) => (
            <li key={key}>
              <strong>{key}:</strong>{" "}
              {Array.isArray(value) ? value.join(", ") : String(value ?? "")}
            </li>
          ))}
        </ul>
        <button onClick={() => { setFinished(false); setCurrentIndex(0); setAnswers({}); }}>
          Start Over
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return <div>No questions available.</div>;
  }

  // Default to patient text (caregiver mode would come from onboarding data later)
  const questionText = currentQuestion.patientText;
  const helpText = currentQuestion.helpText;

  return (
    <div>
      <p>
        Question {currentIndex + 1} of {totalQuestions} — Section:{" "}
        {currentQuestion.section}
      </p>

      <h2>{questionText}</h2>

      {helpText && (
        <p>
          <em>{helpText}</em>
        </p>
      )}

      <QuestionInput
        question={currentQuestion}
        value={answers[currentQuestion.id]}
        onChange={(value) => setAnswer(currentQuestion, value)}
      />

      <div style={{ marginTop: 20 }}>
        {currentIndex > 0 && <button onClick={handleBack}>← Back</button>}
        <button onClick={handleNext} style={{ marginLeft: 10 }}>
          {currentIndex === totalQuestions - 1 ? "Finish" : "Next →"}
        </button>
      </div>
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (value: any) => void;
}) {
  switch (question.type) {
    case "boolean":
      return (
        <div>
          <button
            onClick={() => onChange(true)}
            style={{
              fontWeight: value === true ? "bold" : "normal",
              border: value === true ? "2px solid black" : "1px solid gray",
              padding: "8px 16px",
              marginRight: 8,
            }}
          >
            Yes
          </button>
          <button
            onClick={() => onChange(false)}
            style={{
              fontWeight: value === false ? "bold" : "normal",
              border: value === false ? "2px solid black" : "1px solid gray",
              padding: "8px 16px",
            }}
          >
            No
          </button>
        </div>
      );

    case "single_select":
      return (
        <div>
          {question.options?.map((option) => (
            <div key={String(option.value)} style={{ marginBottom: 4 }}>
              <label>
                <input
                  type="radio"
                  name={question.id}
                  checked={value === option.value}
                  onChange={() => onChange(option.value)}
                />
                {" "}
                {option.iconEmoji && `${option.iconEmoji} `}
                {option.label}
                {option.description && (
                  <span style={{ color: "gray" }}> — {option.description}</span>
                )}
              </label>
            </div>
          ))}
        </div>
      );

    case "multi_select": {
      const selectedValues: any[] = Array.isArray(value) ? value : [];
      return (
        <div>
          {question.options?.map((option) => {
            const isChecked = selectedValues.includes(option.value);
            return (
              <div key={String(option.value)} style={{ marginBottom: 4 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      if (option.value === "none") {
                        onChange(isChecked ? [] : ["none"]);
                      } else {
                        const withoutNone = selectedValues.filter((v) => v !== "none");
                        if (isChecked) {
                          onChange(withoutNone.filter((v) => v !== option.value));
                        } else {
                          onChange([...withoutNone, option.value]);
                        }
                      }
                    }}
                  />
                  {" "}
                  {option.iconEmoji && `${option.iconEmoji} `}
                  {option.label}
                </label>
              </div>
            );
          })}
        </div>
      );
    }

    case "text":
      return (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          style={{ padding: 8, width: "100%", maxWidth: 400 }}
        />
      );

    case "textarea":
      return (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          rows={4}
          style={{ padding: 8, width: "100%", maxWidth: 400 }}
        />
      );

    case "integer":
      return (
        <div>
          <input
            type="number"
            value={value ?? ""}
            onChange={(e) =>
              onChange(e.target.value === "" ? undefined : parseInt(e.target.value))
            }
            placeholder={question.placeholder}
            min={question.validation?.min}
            max={question.validation?.max}
            step={1}
            style={{ padding: 8, width: 150 }}
          />
          {question.unit && <span> {question.unit}</span>}
        </div>
      );

    case "float":
      return (
        <div>
          <input
            type="number"
            value={value ?? ""}
            onChange={(e) =>
              onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))
            }
            placeholder={question.placeholder}
            min={question.validation?.min}
            max={question.validation?.max}
            step={0.1}
            style={{ padding: 8, width: 150 }}
          />
          {question.unit && <span> {question.unit}</span>}
        </div>
      );

    case "scale": {
      const min = question.validation?.min ?? 0;
      const max = question.validation?.max ?? 10;
      return (
        <div>
          <input
            type="range"
            min={min}
            max={max}
            value={value ?? min}
            onChange={(e) => onChange(parseInt(e.target.value))}
            style={{ width: 300 }}
          />
          <span> {value ?? min}</span>
        </div>
      );
    }

    default:
      return <p>Unsupported question type: {question.type}</p>;
  }
}
