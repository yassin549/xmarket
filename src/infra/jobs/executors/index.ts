/**
 * Job Executor Registry
 * 
 * Dispatches jobs to type-specific executors.
 * 
 * Usage:
 *   const result = await executeJob(job);
 */

export interface JobExecutor {
    execute(payload: any): Promise<any>;
}

/**
 * Registry of job executors by job_type
 */
const executors: Record<string, JobExecutor> = {};

/**
 * Register a job executor
 */
export function registerExecutor(jobType: string, executor: JobExecutor): void {
    executors[jobType] = executor;
    console.log(`Registered executor for job type: ${jobType}`);
}

/**
 * Execute a job by dispatching to the appropriate executor
 */
export async function executeJob(jobType: string, payload: any): Promise<any> {
    const executor = executors[jobType];

    if (!executor) {
        throw new Error(`No executor registered for job type: ${jobType}`);
    }

    return await executor.execute(payload);
}

/**
 * Get list of registered job types
 */
export function getRegisteredTypes(): string[] {
    return Object.keys(executors);
}

/**
 * Default export
 */
export default {
    registerExecutor,
    executeJob,
    getRegisteredTypes,
};
