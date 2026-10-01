import { z } from 'zod';
import { EMPLOYEE_DEPARTMENTS, EMPLOYEE_ROLES } from './employees';

const employeeFieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  position: z.string().trim().min(2).max(120),
  department: z.enum(EMPLOYEE_DEPARTMENTS),
  role: z.enum(EMPLOYEE_ROLES),
  phone: z.string().trim().max(40),
});

export const createEmployeeSchema = employeeFieldsSchema.extend({
  password: z.string().min(8).max(128),
});

export const updateEmployeeSchema = employeeFieldsSchema.extend({
  password: z.union([z.literal(''), z.string().min(8).max(128)]).optional(),
  isActive: z.boolean(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
