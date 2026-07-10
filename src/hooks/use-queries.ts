"use client";

import { useQuery } from "@tanstack/react-query";
import { getClientsList } from "@/actions/clients";
import { getProjects, getProject } from "@/actions/projects";
import { getMediaFiles } from "@/actions/media";

/**
 * Hook to fetch and cache the Clients list with staletime of 5 minutes.
 */
export function useClientsListQuery(
  options?: { page?: number; limit?: number; search?: string },
  initialData?: any
) {
  return useQuery({
    queryKey: ["clients", options],
    queryFn: async () => {
      const res = await getClientsList(options);
      if (res.error) throw new Error(res.error);
      return res;
    },
    initialData,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch and cache all Projects with staletime of 3 minutes.
 */
export function useProjectsQuery(initialData?: any[]) {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await getProjects();
      if ("error" in res) throw new Error(res.error as string);
      return res;
    },
    initialData,
    staleTime: 3 * 60 * 1000, // 3 minutes cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch and cache a single Project's details with staletime of 3 minutes.
 */
export function useProjectDetailQuery(projectId: string, initialData?: any) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      return await getProject(projectId);
    },
    initialData,
    enabled: !!projectId,
    staleTime: 3 * 60 * 1000, // 3 minutes cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch and cache project Media Files list with staletime of 2 minutes.
 */
export function useProjectMediaQuery(
  options: { projectId?: string; clientId?: string; page?: number; limit?: number },
  initialData?: any
) {
  return useQuery({
    queryKey: ["project-media", options],
    queryFn: async () => {
      const res = await getMediaFiles(options);
      if (res.error) throw new Error(res.error);
      return res;
    },
    initialData,
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
