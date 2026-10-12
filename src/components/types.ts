import type { ActivityType } from "../lib/activityTypes";

export type Course = {
  id: string;
  name: string;
  code: string | null;
  term: string | null;
  is_active: boolean;
};

export type Activity = {
  activity_type?: ActivityType;
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  status: string;
  course_id: string;
  document_id?: string | null;
  review_required: boolean;
};

export type FilterProps = {
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  courses: Course[];
  courseFilter: string;
  setCourseFilter: (value: string) => void;
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
};
