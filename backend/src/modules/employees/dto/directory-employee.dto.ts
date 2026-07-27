export class DirectoryEmployeeDto {
  id: string;
  displayName: string;
  workEmail: string;
  jobTitle: string;
  startDate: string;
  department: {
    id: string; // fallback to name for now if id is not available
    name: string;
  };
  team: {
    id: string;
    name: string;
  } | null;
  country: {
    code: string;
    name: string;
  };
  manager: {
    id: string;
    displayName: string;
  } | null;
  avatarUrl: string | null;
}

export class PaginatedDirectoryResponse {
  items: DirectoryEmployeeDto[];
  total: number;
  page: number;
  pageSize: number;
}
