import { ApiError } from "@/lib/authApi";

export type QuestionType = "TEXT" | "PARAGRAPH" | "SINGLE_SELECT" | "MULTI_SELECT" | "RADIO" | "ADDRESS" | "AGREEMENT";
export type QuestionScope = "ORDER" | "ATTENDEE";

export type Question = {
  id: number;
  account_id: number;
  organizer_id: number;
  event_id: number;
  title: string;
  description: string | null;
  scope: QuestionScope;
  type: QuestionType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
};

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors);
  }

  return data as T;
}

export function listQuestions(eventId: number) {
  return request<{ questions: Question[] }>(`/api/events/${eventId}/questions`);
}

export function createQuestion(
  eventId: number,
  input: {
    title: string;
    description?: string | null;
    scope: QuestionScope;
    type: QuestionType;
    options?: string[] | null;
    is_required?: boolean;
    sort_order?: number;
  },
) {
  return request<{ question: Question }>(`/api/events/${eventId}/questions`, { method: "POST", body: input });
}

export function updateQuestion(
  eventId: number,
  questionId: number,
  input: {
    title?: string;
    description?: string | null;
    scope?: QuestionScope;
    type?: QuestionType;
    options?: string[] | null;
    is_required?: boolean;
    sort_order?: number;
  },
) {
  return request<{ question: Question }>(`/api/events/${eventId}/questions/${questionId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteQuestion(eventId: number, questionId: number) {
  return request<{ message: string }>(`/api/events/${eventId}/questions/${questionId}`, { method: "DELETE" });
}
