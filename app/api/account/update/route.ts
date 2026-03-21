import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { accountId, newBalance } = body;

        if (!accountId || newBalance === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const dataPath = path.join(process.cwd(), 'data', 'manual_data.json');
        const fileContent = fs.readFileSync(dataPath, 'utf8');
        const data = JSON.parse(fileContent);

        const accountIndex = data.accounts.findIndex((acc: any) => acc.id === accountId);

        if (accountIndex === -1) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        // Update the balance
        data.accounts[accountIndex].currentBalance = Number(newBalance);

        // Write back to file
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 4));

        return NextResponse.json({ success: true, account: data.accounts[accountIndex] });
    } catch (error) {
        console.error('Error updating account balance:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
