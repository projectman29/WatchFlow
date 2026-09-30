export const EMPLOYEE_ROLES = [
  'admin',
  'manager',
  'sales',
  'designer',
  'master',
  'warehouse',
  'logistics',
  'marketing',
] as const;

export const EMPLOYEE_DEPARTMENTS = [
  'Administration',
  'Sales',
  'Production',
  'Warehouse',
  'Logistics',
  'Marketing',
] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];
export type EmployeeDepartment = (typeof EMPLOYEE_DEPARTMENTS)[number];

export type Employee = {
  id: string;
  name: string;
  position: string;
  department: EmployeeDepartment;
  role: EmployeeRole;
  email: string;
  phone: string;
  isActive: boolean;
  status: 'active' | 'on_leave' | 'inactive';
};

type EmployeeState = {
  directory: Employee[];
};

const globalEmployeeState = globalThis as typeof globalThis & {
  __watchflowEmployees?: EmployeeState;
};

export const employeeDirectory: Employee[] = (globalEmployeeState.__watchflowEmployees ??= {
  directory: [
    {
      id: 'emp-100',
      name: 'Александр Поляков',
      position: 'Owner',
      department: 'Administration',
      role: 'admin',
      email: 'admin@watchflow.local',
      phone: '+7 700 000 00 00',
      isActive: true,
      status: 'active',
    },
    {
      id: 'emp-101',
      name: 'Марина Соколова',
      position: 'РОП',
      department: 'Sales',
      role: 'manager',
      email: 'manager@watchflow.local',
      phone: '+7 701 111 22 33',
      isActive: true,
      status: 'active',
    },
    {
      id: 'emp-102',
      name: 'Иван Петров',
      position: 'Менеджер по продажам',
      department: 'Sales',
      role: 'sales',
      email: 'sales@watchflow.local',
      phone: '+7 702 333 44 55',
      isActive: true,
      status: 'active',
    },
    {
      id: 'emp-103',
      name: 'Екатерина Ли',
      position: 'Дизайнер',
      department: 'Production',
      role: 'designer',
      email: 'designer@watchflow.local',
      phone: '+7 705 778 12 03',
      isActive: true,
      status: 'active',
    },
    {
      id: 'emp-104',
      name: 'Сергей Ким',
      position: 'Мастер производства',
      department: 'Production',
      role: 'master',
      email: 'master@watchflow.local',
      phone: '+7 706 201 14 88',
      isActive: true,
      status: 'on_leave',
    },
    {
      id: 'emp-105',
      name: 'Наталья Журавлёва',
      position: 'Складской менеджер',
      department: 'Warehouse',
      role: 'warehouse',
      email: 'warehouse@watchflow.local',
      phone: '+7 708 334 97 10',
      isActive: true,
      status: 'active',
    },
    {
      id: 'emp-106',
      name: 'Дмитрий Лосев',
      position: 'Логист',
      department: 'Logistics',
      role: 'logistics',
      email: 'logistics@watchflow.local',
      phone: '+7 709 881 77 01',
      isActive: true,
      status: 'active',
    },
  ],
}).directory;

export function normalizeEmployee(input: Partial<Employee> & Pick<Employee, 'name' | 'email'>): Employee {
  return {
    id: input.id ?? `emp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    position: input.position ?? 'Специалист',
    department: (input.department ?? 'Sales') as EmployeeDepartment,
    role: (input.role ?? 'sales') as EmployeeRole,
    email: input.email,
    phone: input.phone ?? '+7 700 000 00 00',
    isActive: input.isActive ?? true,
    status: input.status ?? (input.isActive === false ? 'inactive' : 'active'),
  };
}

export function createEmployee(input: Partial<Employee> & Pick<Employee, 'name' | 'email'>): Employee {
  const employee = normalizeEmployee(input);
  employeeDirectory.push(employee);
  return employee;
}

export function updateEmployee(id: string, changes: Partial<Employee>): Employee {
  const index = employeeDirectory.findIndex((employee) => employee.id === id);
  if (index === -1) {
    throw new Error(`Employee not found: ${id}`);
  }

  const current = employeeDirectory[index];
  const updated = {
    ...current,
    ...changes,
    isActive: changes.isActive ?? current.isActive,
    status: changes.status ?? current.status,
  };

  employeeDirectory[index] = updated;
  return updated;
}

export function deleteEmployee(id: string): Employee {
  const index = employeeDirectory.findIndex((employee) => employee.id === id);
  if (index === -1) {
    throw new Error(`Employee not found: ${id}`);
  }

  const [removed] = employeeDirectory.splice(index, 1);
  return removed;
}

export function toggleEmployeeStatus(id: string, isActive: boolean): Employee {
  return updateEmployee(id, {
    isActive,
    status: isActive ? 'active' : 'inactive',
  });
}

export function getEmployeeSummary(items: ReadonlyArray<Employee>) {
  const byDepartment = items.reduce<Record<string, number>>((acc, employee) => {
    acc[employee.department] = (acc[employee.department] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total: items.length,
    active: items.filter((employee) => employee.isActive).length,
    byDepartment,
  };
}
