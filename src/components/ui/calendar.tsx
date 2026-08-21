import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker, type DayPickerProps } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import 'react-day-picker/style.css'

export type CalendarProps = DayPickerProps

// Themed via the same hsl(var(--...)) tokens as the rest of ui/ so it
// renders correctly in both the light App Builder shell and the dark
// runtime — react-day-picker v10 ships its own base stylesheet (imported
// above) which this className map overrides per-slot.
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-3',
        month_caption: 'flex justify-center pt-1 relative items-center w-full',
        caption_label: 'text-[13px] font-medium',
        nav: 'flex items-center gap-1 absolute inset-x-0 top-0 justify-between px-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100',
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100',
        ),
        month_grid: 'w-full border-collapse mt-2',
        weekdays: 'flex',
        weekday: 'w-8 text-[11px] font-normal',
        week: 'flex w-full mt-1',
        day: 'p-0 text-center text-[12px] relative [&:has([aria-selected])]:rounded-md focus-within:relative focus-within:z-20',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-8 w-8 p-0 font-normal aria-selected:opacity-100 rounded-md',
        ),
        range_end: 'day-range-end',
        selected:
          'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] focus:bg-[hsl(var(--primary))] focus:text-[hsl(var(--primary-foreground))] [&>button]:bg-[hsl(var(--primary))] [&>button]:text-[hsl(var(--primary-foreground))]',
        today: 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] rounded-md',
        outside: 'text-[hsl(var(--muted-foreground))] opacity-50 aria-selected:opacity-30',
        disabled: 'text-[hsl(var(--muted-foreground))] opacity-40',
        range_middle: 'aria-selected:bg-[hsl(var(--accent))] aria-selected:text-[hsl(var(--accent-foreground))]',
        hidden: 'invisible',
        ...classNames,
      }}
      style={{ color: 'hsl(var(--foreground))' }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" {...chevronProps} />
          ) : (
            <ChevronRight className="h-4 w-4" {...chevronProps} />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
