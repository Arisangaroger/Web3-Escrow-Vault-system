import { IsEnum } from 'class-validator';

export enum ResolutionOutcome {
  DRIVER_FRAUD = 'DRIVER_FRAUD',
  FAULTY_GOODS = 'FAULTY_GOODS',
  FALSE_BUYER_CLAIM = 'FALSE_BUYER_CLAIM',
}

export class ResolveDisputeDto {
  @IsEnum(ResolutionOutcome)
  outcome: ResolutionOutcome;
}
