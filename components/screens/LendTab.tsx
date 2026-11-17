'use client';
import { useState } from 'react';
import { HugeNumber } from '../ui/HugeNumber';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { recordRepayment, reopenLoan, setLoanDue, undoLastRepayment, useLoans, useToday, writeOffLoan } from '@/db/queries';
import type { Loan } from '@/db/schema';
import { addDays, formatShort } from '@/lib/dates';
import { inr } from '@/lib/format';
import { cleanAmountInput, roundMoney } from '@/lib/money';
import { closedLoans, dueText, loanName, loanStatus, openLoans, remaining, repaid, summarize } from '@/lib/lend';
import { useToast } from '@/store/toast';

const action = 'min-h-0 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink active:bg-tint';

/**
 * History > Lend. Looks like Today: the total is the same HugeNumber, rows use Today's spend-row type.
 * Tap a person for what you can do: got it back, part paid, push a week, change "will they pay", write off.
 */
export function LendTab() {
  const loans = useLoans();
  const today = useToday();
  const toast = useToast((s) => s.show);
  const [openId, setOpenId] = useState<string | null>(null);
  const [part, setPart] = useState<string | null>(null);
  const [partAmt, setPartAmt] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [confirmOff, setConfirmOff] = useState<Loan | null>(null);

  if (!loans) return null;
  const open = openLoans(loans);
  const closed = closedLoans(loans);
  const sum = summarize(loans, today);

  async function gotIt(l: Loan) {
    const owed = remaining(l);
    if (await recordRepayment(l.id, owed)) toast(`${loanName(l)} paid back ${inr(owed)}`);
    setOpenId(null);
  }
  async function partPaid(l: Loan) {
    const a = Math.min(roundMoney(Number(partAmt) || 0), remaining(l));
    if (a <= 0) {
      toast('Enter what came back', 'warm');
      return;
    }
    await recordRepayment(l.id, a);
    toast(`${inr(a)} from ${loanName(l)} noted`);
    setPart(null);
    setPartAmt('');
  }

  const row = (l: Loan) => {
    const status = loanStatus(l, today);
    const isOpen = openId === l.id;
    const left = remaining(l);
    return (
      <li key={l.id} className="py-3">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => {
            setOpenId(isOpen ? null : l.id);
            setPart(null);
          }}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-ink">{loanName(l)}</span>
            <span className={`block truncate text-[13px] ${status === 'overdue' ? 'text-warm' : 'text-soft'}`}>
              {l.person.trim() ? `${l.kind} · ` : ''}
              {dueText(l, today)}
            </span>
            {repaid(l) > 0 && left > 0 && (
              <span className="block text-[12px] text-faint">
                {inr(repaid(l))} back of {inr(l.amount)}
              </span>
            )}
          </span>
          <span className="num text-[20px] text-ink">{inr(left > 0 ? left : l.amount)}</span>
        </button>

        {isOpen && (
          <div className="mt-2">
            <p className="text-[13px] text-soft">
              Lent {formatShort(l.lentOn)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {left > 0 && (
                <>
                  <button type="button" className={action} onClick={() => void gotIt(l)}>
                    Got it back
                  </button>
                  <button
                    type="button"
                    className={action}
                    onClick={() => {
                      setPart(l.id);
                      setPartAmt('');
                    }}
                  >
                    Part paid
                  </button>
                  <button
                    type="button"
                    className={action}
                    onClick={() => {
                      void setLoanDue(l.id, addDays(l.dueDate && l.dueDate > today ? l.dueDate : today, 7));
                      toast('Pushed a week');
                    }}
                  >
                    Push a week
                  </button>
                  <button type="button" className={`${action} text-warm`} onClick={() => setConfirmOff(l)}>
                    Write off
                  </button>
                </>
              )}
              {l.writtenOff && (
                <button
                  type="button"
                  className={action}
                  onClick={() => {
                    void reopenLoan(l.id);
                    toast('Write-off undone');
                  }}
                >
                  Undo write-off
                </button>
              )}
              {l.repayments.length > 0 && (
                <button
                  type="button"
                  className={action}
                  onClick={() => {
                    void undoLastRepayment(l.id);
                    toast('Last repayment undone');
                  }}
                >
                  Undo last repayment
                </button>
              )}
            </div>
            {part === l.id && (
              <div className="mt-2 flex gap-2">
                <input
                  aria-label="Amount received"
                  inputMode="decimal"
                  autoFocus
                  value={partAmt}
                  onChange={(e) => setPartAmt(cleanAmountInput(e.target.value))}
                  placeholder="Amount received"
                  className="num h-11 min-w-0 flex-1 rounded-key border border-line px-3 text-[15px] text-ink placeholder:text-faint"
                />
                <button type="button" onClick={() => void partPaid(l)} className="h-11 rounded-key bg-ink px-4 text-[14px] font-semibold text-white">
                  Save
                </button>
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      <p className="mt-4 text-[15px] text-soft">Still to get back</p>
      <HugeNumber value={sum.total} className="mt-1" />
      <p className={`mt-2 text-[15px] ${sum.overdue ? 'text-warm' : 'text-soft'}`}>
        {sum.people === 0
          ? 'Nobody owes you right now.'
          : `${sum.people} ${sum.people === 1 ? 'person' : 'people'}${sum.overdue ? ` · ${sum.overdue} overdue` : ''}`}
      </p>

      <section className="mt-6" aria-label="Lent">
        {open.length === 0 && closed.length === 0 ? (
          <p className="text-body text-soft">Lent money to someone? Flip Spend to Lend when you log it and it shows up here.</p>
        ) : (
          open.length > 0 && (
            <>
              <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-soft">Lent</p>
              <ul className="divide-y divide-line">{open.map(row)}</ul>
            </>
          )
        )}
        {closed.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={showClosed}
              onClick={() => setShowClosed((s) => !s)}
              className="mt-4 flex min-h-[44px] w-full items-center justify-between text-[12px] font-semibold uppercase tracking-wide text-soft"
            >
              <span>Paid back · {closed.length}</span>
              <span aria-hidden="true">{showClosed ? '−' : '+'}</span>
            </button>
            {showClosed && <ul className="divide-y divide-line">{closed.map(row)}</ul>}
          </>
        )}
      </section>

      {confirmOff && (
        <ConfirmDialog
          title={`Write off ${inr(remaining(confirmOff))}?`}
          body={`${loanName(confirmOff)} won't be asked for it any more. It counts as spent in this month's numbers: that money is gone. Until now lending never touched them.`}
          confirmLabel="Write off"
          onCancel={() => setConfirmOff(null)}
          onConfirm={() => {
            void writeOffLoan(confirmOff.id);
            toast('Written off');
            setConfirmOff(null);
            setOpenId(null);
          }}
        />
      )}
    </>
  );
}
