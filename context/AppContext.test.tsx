import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from './AppContext';
import React from 'react';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe('AppContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);

    // Default mock for initial data fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  describe('useApp hook', () => {
    it('should throw error when used outside AppProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useApp());
      }).toThrow('useApp must be used within an AppProvider');

      consoleSpy.mockRestore();
    });

    it('should provide context when used within AppProvider', async () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.projects).toEqual([]);
        expect(result.current.results).toEqual([]);
        expect(result.current.user).toBeNull();
      });
    });
  });

  describe('Authentication', () => {
    it('should login a user', async () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });

      act(() => {
        result.current.login('admin@test.com', 'Admin');
      });

      expect(result.current.user).toEqual({
        name: 'Alex Administrator',
        email: 'admin@test.com',
        role: 'Admin',
        initials: 'AA',
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'academica_user_v1',
        expect.any(String)
      );
    });

    it('should login an analyst', async () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });

      act(() => {
        result.current.login('analyst@test.com', 'Analyst');
      });

      expect(result.current.user).toEqual({
        name: 'Diana Analyst',
        email: 'analyst@test.com',
        role: 'Analyst',
        initials: 'DA',
      });
    });

    it('should logout a user', async () => {
      const { result } = renderHook(() => useApp(), { wrapper });

      // First login
      act(() => {
        result.current.login('admin@test.com', 'Admin');
      });

      expect(result.current.user).not.toBeNull();

      // Then logout
      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('academica_user_v1');
    });

    it('should restore user from localStorage', async () => {
      const savedUser = {
        name: 'Saved User',
        email: 'saved@test.com',
        role: 'Admin',
        initials: 'SU',
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedUser));

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(savedUser);
      });
    });
  });

  describe('Projects', () => {
    it('should add a project', async () => {
      const newProject = {
        id: 'p-123',
        name: 'Test Project',
        description: 'Test Description',
        created_at: '2025-01-01',
        last_run: 'Never',
        status: 'Active',
        results_count: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      }).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      }).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newProject),
      });

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.projects).toEqual([]);
      });

      await act(async () => {
        await result.current.addProject('Test Project', 'Test Description');
      });

      await waitFor(() => {
        expect(result.current.projects).toHaveLength(1);
        expect(result.current.projects[0].name).toBe('Test Project');
      });
    });

    it('should edit a project', async () => {
      const existingProject = {
        id: 'p-123',
        name: 'Original Name',
        description: 'Original Description',
        created_at: '2025-01-01',
        last_run: 'Never',
        status: 'Active',
        results_count: 0,
      };

      const updatedProject = {
        ...existingProject,
        name: 'Updated Name',
        description: 'Updated Description',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([existingProject]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(updatedProject),
        });

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.projects).toHaveLength(1);
      });

      await act(async () => {
        await result.current.editProject('p-123', 'Updated Name', 'Updated Description');
      });

      await waitFor(() => {
        expect(result.current.projects[0].name).toBe('Updated Name');
        expect(result.current.projects[0].description).toBe('Updated Description');
      });
    });

    it('should delete a project', async () => {
      const existingProject = {
        id: 'p-123',
        name: 'To Delete',
        description: 'Will be deleted',
        created_at: '2025-01-01',
        last_run: 'Never',
        status: 'Active',
        results_count: 0,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([existingProject]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ message: 'Deleted' }),
        });

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.projects).toHaveLength(1);
      });

      await act(async () => {
        await result.current.deleteProject('p-123');
      });

      await waitFor(() => {
        expect(result.current.projects).toHaveLength(0);
      });
    });
  });

  describe('Results', () => {
    it('should add targets to a project', async () => {
      const existingProject = {
        id: 'p-123',
        name: 'Test Project',
        description: 'Test',
        created_at: '2025-01-01',
        last_run: 'Never',
        status: 'Active',
        results_count: 0,
      };

      const newResults = [
        {
          id: 'r-1',
          project_id: 'p-123',
          school_name: 'Harvard',
          program_name: 'MBA',
          status: 'Pending',
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([existingProject]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(newResults),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ...existingProject, results_count: 1 }),
        });

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.projects).toHaveLength(1);
      });

      await act(async () => {
        await result.current.addTargets('p-123', [
          { schoolName: 'Harvard', programName: 'MBA' },
        ]);
      });

      await waitFor(() => {
        expect(result.current.results).toHaveLength(1);
      });
    });

    it('should update a result', async () => {
      const existingResult = {
        id: 'r-123',
        project_id: 'p-123',
        school_name: 'Harvard',
        program_name: 'MBA',
        status: 'Pending',
        tuition_amount: null,
      };

      const updatedResult = {
        ...existingResult,
        status: 'Success',
        tuition_amount: '$75,000',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([existingResult]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(updatedResult),
        });

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.results).toHaveLength(1);
      });

      await act(async () => {
        await result.current.updateResult('r-123', {
          status: 'Success' as any,
          tuition_amount: '$75,000',
        });
      });

      await waitFor(() => {
        expect(result.current.results[0].tuition_amount).toBe('$75,000');
      });
    });

    it('should delete a result', async () => {
      const existingProject = {
        id: 'p-123',
        name: 'Test Project',
        description: 'Test',
        created_at: '2025-01-01',
        last_run: 'Never',
        status: 'Active',
        results_count: 1,
      };

      const existingResult = {
        id: 'r-123',
        project_id: 'p-123',
        school_name: 'Harvard',
        program_name: 'MBA',
        status: 'Pending',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([existingProject]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([existingResult]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ message: 'Deleted' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ...existingProject, results_count: 0 }),
        });

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current.results).toHaveLength(1);
      });

      await act(async () => {
        await result.current.deleteResult('r-123', 'p-123');
      });

      await waitFor(() => {
        expect(result.current.results).toHaveLength(0);
      });
    });
  });

  describe('History and Trends', () => {
    it('should fetch result history', async () => {
      const historyData = [
        { id: 'r-1', extraction_version: 1, tuition_amount: '$70,000' },
        { id: 'r-2', extraction_version: 2, tuition_amount: '$75,000' },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(historyData),
        });

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      let history: any[];
      await act(async () => {
        history = await result.current.getResultHistory('r-1');
      });

      expect(history!).toEqual(historyData);
    });

    it('should fetch trends data', async () => {
      const trendsData = [
        { school_name: 'Harvard', tuition_amount: '$75,000', extraction_version: 1 },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(trendsData),
        });

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      let trends: any[];
      await act(async () => {
        trends = await result.current.getTrendsData('p-123');
      });

      expect(trends!).toEqual(trendsData);
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        // Should not crash, just have empty arrays
        expect(result.current.projects).toEqual([]);
        expect(result.current.results).toEqual([]);
      });

      consoleSpy.mockRestore();
    });

    it('should return empty array when history fetch fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockRejectedValueOnce(new Error('History fetch failed'));

      const { result } = renderHook(() => useApp(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      let history: any[];
      await act(async () => {
        history = await result.current.getResultHistory('r-1');
      });

      expect(history!).toEqual([]);
      consoleSpy.mockRestore();
    });
  });
});
