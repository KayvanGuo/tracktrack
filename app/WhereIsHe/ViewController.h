//
//  ViewController.h
//  WhereIsHe
//
//  Created by tomaszbrue on 14.08.13.
//  Copyright (c) 2013 InformMe. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <CoreLocation/CoreLocation.h>

@interface ViewController : UIViewController <UITextFieldDelegate>

@property (readwrite) IBOutlet UITextField *waitingCount;
@property (readwrite) IBOutlet UIButton *bytesSentRevert;
@property (readwrite) IBOutlet UISwitch *onOff;
@property (readwrite) IBOutlet UITextField *bytesSent;
@property (readwrite) IBOutlet UITextField *labelSentMsg;
@property (readwrite) IBOutlet UIButton *labelSentButton;
@property (nonatomic, retain) NSTimer *timer;

- (void)startUpdating;
- (void)stopUpdating;

@end
