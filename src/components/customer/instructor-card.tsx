import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CATEGORY_LABELS, RANK_LABELS, type Category, type InstructorRank } from '@/types';

interface InstructorCardProps {
  instructor: {
    id: string;
    nickname: string;
    avatar_url: string | null;
    public_bio: string | null;
    categories: Category[] | null;
    genres?: string[] | null;
    rank: InstructorRank;
  };
  /** ランク別指名料（システム設定から渡される） */
  designationFee: number;
}

const RANK_VARIANT: Record<InstructorRank, 'rankGold' | 'rankSilver' | 'rankBronze' | 'rankRegular'> =
  {
    gold: 'rankGold',
    silver: 'rankSilver',
    bronze: 'rankBronze',
    regular: 'rankRegular',
  };

export function InstructorCard({ instructor, designationFee }: InstructorCardProps) {
  const initials = instructor.nickname.slice(0, 2);
  return (
    <Link href={`/mypage/instructors/${instructor.id}`} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex gap-4 p-4">
          <Avatar className="h-16 w-16 shrink-0">
            {instructor.avatar_url && <AvatarImage src={instructor.avatar_url} alt={instructor.nickname} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{instructor.nickname}先生</h3>
              <Badge variant={RANK_VARIANT[instructor.rank]}>
                {RANK_LABELS[instructor.rank]}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {instructor.categories?.map((c) => (
                <Badge key={c} variant="outline" className="text-xs">
                  {CATEGORY_LABELS[c]}
                </Badge>
              ))}
            </div>
            {instructor.genres && instructor.genres.length > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {instructor.genres.join(' / ')}
              </p>
            )}
            {instructor.public_bio && (
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {instructor.public_bio}
              </p>
            )}
            <p className="mt-2 text-xs">
              <span className="text-muted-foreground">指名料: </span>
              <span className="font-mono">
                {designationFee > 0 ? `+¥${designationFee.toLocaleString()}` : '無料'}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
