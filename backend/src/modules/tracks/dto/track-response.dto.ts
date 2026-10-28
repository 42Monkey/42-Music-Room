import { ApiProperty } from '@nestjs/swagger';

export class TrackResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'roomId_abc123' })
  roomId: string;

  @ApiProperty({ example: '313555' })
  deezerTrackId: string;

  @ApiProperty({ example: 'Around the World' })
  title: string;

  @ApiProperty({ example: 'Daft Punk' })
  artist: string;

  @ApiProperty({ example: 'Homework' })
  album: string;

  @ApiProperty({ example: 443 })
  duration: number;

  @ApiProperty({ example: 'https://api.deezer.com/album/302127/image' })
  coverUrl: string;

  @ApiProperty({ example: 5 })
  votesCount: number;

  @ApiProperty({ example: true })
  votedByMe: boolean;

  @ApiProperty({ example: 1 })
  position: number;
}

export class TrackMessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}
