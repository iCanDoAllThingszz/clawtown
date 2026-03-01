import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import path from 'path'
import os from 'os'

export interface CommitInfo {
  time: string
  message: string
}

export async function GET() {
  try {
    const repoPath = path.join(os.homedir(), '.openclaw', 'workspace', 'projects', 'clawtown')

    // Get git log with time and message
    const gitLog = execSync('git log --format="%H|%ci|%s" -n 10', {
      cwd: repoPath,
      encoding: 'utf-8',
    })

    const commits: CommitInfo[] = gitLog
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split('|')
        if (parts.length < 3) return null

        const [, , datetime] = parts
        const message = parts.slice(2).join('|')

        // Parse datetime to get time only
        let time = ''
        try {
          const date = new Date(datetime)
          time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
        } catch {
          time = '00:00'
        }

        return {
          time,
          message: message.substring(0, 50), // Limit message length
        }
      })
      .filter((c): c is CommitInfo => c !== null)

    return NextResponse.json({ commits })
  } catch (error) {
    console.error('Error getting git log:', error)
    return NextResponse.json({ commits: [] })
  }
}
